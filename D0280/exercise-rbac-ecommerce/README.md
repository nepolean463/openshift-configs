# RBAC E-commerce Exercise - CI/CD Automated

Complete enterprise-grade RBAC exercise with GitHub Actions automation.

## Deploy via GitHub Actions

1. Go to: https://github.com/nepolean463/openshift-configs/actions
2. Click: **Deploy RBAC Exercise**
3. Select: **deploy**
4. Click: **Run workflow**

✅ Everything deploys automatically!

## Cleanup (Save Resources)

1. Same workflow
2. Select: **cleanup**
3. Click: **Run workflow**

🧹 All deleted! Manifests stay in Git.

## Test RBAC

```bash
# prod-admin: admin in ecommerce-prod
oc login -u prod-admin -p Openshift123!
oc get pods -n ecommerce-prod  # ✅ Works

# dev-user1: edit in ecommerce-dev
oc login -u dev-user1 -p <password>
oc get pods -n ecommerce-dev   # ✅ Works

# qa-tester: view in both
oc login -u qa-tester -p <password>
oc get pods -n ecommerce-prod  # ✅ Works (read-only)
