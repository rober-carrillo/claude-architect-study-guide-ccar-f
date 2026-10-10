---
paths:
  - "terraform/**/*"
---
# Terraform conventions (loaded only when working under terraform/)

- Every resource has `tags = local.common_tags`.
- No hard-coded account IDs or regions; use variables.
- You may run `terraform fmt` and `terraform validate`. Never run `terraform apply`.
