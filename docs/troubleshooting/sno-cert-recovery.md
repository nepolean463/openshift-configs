# Troubleshooting OpenShift 4 SNO: Certificate Expiration After Long Power-Off

## Overview
When an OpenShift 4 cluster—particularly a Single Node OpenShift (SNO) deployment—is powered off for an extended period (typically more than 30 days), its internal certificates expire. Because the cluster is offline, the automated certificate rotation cannot occur. 

Upon booting, the `kubelet` client certificates are invalid, preventing communication with the `kube-apiserver`. This locks the cluster in a degraded state where automated CSR (Certificate Signing Request) approvals fail, and the node remains unready.

## Symptoms
* The cluster fails to become fully healthy after booting up.
* Standard `oc` commands fail with kubeconfig errors (e.g., `Missing or incomplete configuration info`).
* Checking `oc get csr` reveals multiple CSRs stuck in a `Pending` state for days or weeks.

## Recovery Steps

### 1. SSH into the Control Plane Node
You must perform these steps directly on the node. SSH into the OpenShift node as the `root` or `core` user.

### 2. Export the Internal Kubeconfig
Because the standard authentication might be broken or missing, bypass it by using the highly privileged, internal `localhost.kubeconfig` used by the static pods.

```bash
export KUBECONFIG=/etc/kubernetes/static-pod-resources/kube-apiserver-certs/secrets/node-kubeconfigs/localhost.kubeconfig

**### 3. Check for Pending CSRs**
List the current Certificate Signing Requests to confirm they are stuck in Pending. You will likely see requests for kube-apiserver-client-kubelet and kubelet-serving.

Bash
oc get csr
4. Approve the First Batch of CSRs
Force-approve all pending CSRs. This allows the Kubelet to securely communicate with the API server again.

Bash
oc get csr -o name | xargs oc adm certificate approve
5. Wait and Approve the Second Batch (Serving Certs)
Once the Kubelet regains access to the API server, it will realize its server/serving certificates are also expired. It will quickly generate a new batch of CSRs.

Wait 1 to 2 minutes, verify the new requests, and approve them as well:

Bash
# Check for new pending requests
oc get csr

# Approve the new requests
oc get csr -o name | xargs oc adm certificate approve
6. Verify Cluster Health
Once all CSRs are approved (showing as Approved,Issued), the Kubelet will resume normal operations. Verify that the node transitions to a Ready state.

Bash
oc get nodes
oc get clusteroperators
Note: Depending on how long the cluster was offline, you may need to wait a few minutes for all control plane operators to successfully sync and update.
