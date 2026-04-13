# OKD 4.16 SNO Certificate Expiration and Deadlock Recovery Guide

## Scenario & Symptoms
When a Single Node OpenShift (SNO) cluster is shut down for several months, its internal certificates naturally expire. When the cluster is eventually powered back online, you will usually observe the following symptoms:
1. The Node status is firmly stuck at `NotReady`.
2. Core cluster operators (like `network`, `authentication`, `kube-apiserver`) are `Degraded` and constantly crashlooping.
3. The CNI pods (like `multus`) are stuck in a `Pending` state indefinitely.
4. Attempting to use standard `oc` commands might fail completely, requiring SSH access and the use of the node's `localhost-recovery.kubeconfig`.

## Root Cause Analysis & Reasoning

The issue is fundamentally a **Certificate Rotation and Webhook Deadlock**. The deadlock occurs through this specific sequence of dependent failures:

1. **Scheduler Authentication Failure:** 
   The `kube-scheduler` static pod uses internal client certificates to authenticate with the `kube-apiserver`. Because the cluster was offline, these certificates expired without being rotated by the cert-sync operator. Consequently, the scheduler receives a HTTP 401 `Unauthorized` and fails to list or schedule any pods.
2. **Missing CA Bundles:** 
   The `extension-apiserver-authentication` ConfigMap in the `kube-system` namespace hosts the front-proxy CA (`requestheader-client-ca-file`), which the control plane needs. This is typically synced by the `authentication-operator`. Since the network is down and operators are crashing, this ConfigMap remains incorrectly configured, causing internal APIServer processes/informers to hang or throw errors.
3. **Webhook Rejection Trap:** 
   The cluster possesses a `ValidatingWebhookConfiguration` (specifically `network-node-identity.openshift.io`) that intercepts pod scheduling/updates and validates them against the `multus-admission-controller` running on the node (`127.0.0.1:9743`). 

**The Deadlock Loop:**
- `multus` cannot deploy because the `kube-scheduler` is `Unauthorized` and the API rejects pod tracking entirely because the admission webhook is failing continuously (the `multus-admission-controller` isn't running).
- Cluster operators cannot fix the missing CA bundles because they require the pod network (`multus`) to spin up.
- The `kube-scheduler` cannot re-authorize until the operators fix the CA bundles and rotate the certs.

## Step-by-Step Recovery Procedure

To forcefully break this deadlock, execute these steps by accessing the node directly via SSH.

### 1. SSH into the Cluster Node
Establish an SSH connection to the node as the `core` user:
```bash
ssh -i /path/to/private/key core@<node-ip>
```
Export the emergency recovery kubeconfig to bypass external authentication issues:
```bash
export KUBECONFIG=/etc/kubernetes/static-pod-resources/kube-apiserver-certs/secrets/node-kubeconfigs/localhost-recovery.kubeconfig
```

### 2. Inject Super-Admin Credentials into Static Pods
To bypass the `kube-scheduler` and `kube-controller-manager` authorization failures, temporarily replace their expired client certificates with the `localhost-recovery` super-admin kubeconfig.

```bash
# Locate the current active kubeconfig files for scheduler and controller-manager
L=/etc/kubernetes/static-pod-resources/kube-apiserver-certs/secrets/node-kubeconfigs/localhost-recovery.kubeconfig
S=$(sudo ls -t /etc/kubernetes/static-pod-resources/kube-scheduler-pod-*/configmaps/scheduler-kubeconfig/kubeconfig | head -n 1)
C=$(sudo ls -t /etc/kubernetes/static-pod-resources/kube-controller-manager-pod-*/configmaps/controller-manager-kubeconfig/kubeconfig | head -n 1)

# Back up the expired certs
sudo cp $S $S.backup
sudo cp $C $C.backup

# Override with the valid recovery kubeconfig
sudo cp $L $S
sudo cp $L $C
```

### 3. Restore the Missing Aggregator CA Bundle
The scheduler relies on the `extension-apiserver-authentication` config map. Since it's missing the `requestheader-client-ca-file`, manually inject it from the node's static apiserver resources:

```bash
# Copy the aggregator CA to a temporary location
sudo cp /etc/kubernetes/static-pod-resources/kube-apiserver-certs/configmaps/aggregator-client-ca/ca-bundle.crt /tmp/req.crt

# Inject it into the ConfigMap
sudo -E oc set data cm/extension-apiserver-authentication --from-file=requestheader-client-ca-file=/tmp/req.crt -n kube-system
```

### 4. Delete the Blocking Validating Webhook
To stop the API server from actively rejecting pod scheduling because `multus` is offline, forcefully delete the `network-node-identity` validating webhook. The OpenShift `network-operator` will automatically recreate it later once things are healthy.

```bash
sudo -E oc delete validatingwebhookconfiguration network-node-identity.openshift.io
```

### 5. Kick the Static Pods
Force the `kubelet` to re-sync and cleanly restart the `kube-scheduler` and `kube-controller-manager` by temporarily moving their manifests out of the monitoring directory and back in:

```bash
sudo mv /etc/kubernetes/manifests/kube-scheduler-pod.yaml /tmp/
sudo mv /etc/kubernetes/manifests/kube-controller-manager-pod.yaml /tmp/
sleep 5
sudo mv /tmp/kube-scheduler-pod.yaml /etc/kubernetes/manifests/
sudo mv /tmp/kube-controller-manager-pod.yaml /etc/kubernetes/manifests/
```

### 6. Verify Recovery
Once the scheduler successfully restarts and acquires its leader lease, it will break the logjam and schedule the `multus` daemonsets. The node will swiftly complete network initialization and return to a `Ready` state.

```bash
# Verify multus initializes properly
sudo -E oc get pods -n openshift-multus

# Verify node status returns to Ready
sudo -E oc get nodes

# Observe cluster operators recovering
sudo -E oc get co
```

---

## Interview Q&A Session: OpenShift Certificate & Control Plane Diagnostics

**Q1: In an OpenShift environment, what happens if the internal `kube-apiserver`, `kube-scheduler`, and `kube-controller` certificates expire?**
**Answer:** The static pods like `kube-scheduler` and `kube-controller-manager` will fail to authenticate with the `kube-apiserver`, logging HTTP 401 `Unauthorized` errors. Because of this, they will lose their leader election leases and completely fail to process their control loops or schedule pods, bringing core cluster operations to a halt. In OpenShift, these certificates are automatically rotated by built-in operators, but if a node is powered down for several months, they will expire, causing a fatal deadlock upon reboot.

**Q2: What is the `localhost-recovery.kubeconfig` used for in OpenShift, and where is it located?**
**Answer:** It is a special, static, super-admin kubeconfig generated during cluster installation that bundles valid system administrative certificates. It allows cluster administrators to communicate directly with the local apiserver component, bypassing identity providers (IDPs) or external authentication layers in case of emergencies. It is located statically on master nodes at: `/etc/kubernetes/static-pod-resources/kube-apiserver-certs/secrets/node-kubeconfigs/localhost-recovery.kubeconfig`.

**Q3: Describe a scenario where a ValidatingWebhookConfiguration could crash a cluster, and how to fix it.**
**Answer:** "Fail-closed" validating webhooks mandate that a separate webhook controller (e.g., `multus-admission-controller`) aggressively validates specific API requests. If a cluster reboots and the webhook controller pods fail to start (due to scheduling or network constraints), the central API server will reject all incoming object modifications because the webhook timeout fails closed. This creates a severe chicken-and-egg situation—the webhook pod itself cannot be scheduled/repaired. The immediate fix is to use `oc delete validatingwebhookconfiguration <webhook-name>` to temporarily remove the strict verification restriction. Once the cluster recovers, the parent operator will reconcile and automatically safely recreate the webhook.

**Q4: How do you manually restart a Static Pod (like `kube-scheduler` or `etcd`) in OpenShift without restarting the `kubelet` or rebooting the node?**
**Answer:** Static pods are exclusively managed locally by the Kubelet constantly watching the `/etc/kubernetes/manifests/` directory footprint. To forcefully restart one, you simply move the target pod's YAML manifest file out of the directory (e.g., `mv` to `/tmp/`), wait roughly five seconds for the Kubelet to register its absence and internally terminate the container, and then forcefully move the file back into the `manifests` directory to instigate fresh pod recreation.
