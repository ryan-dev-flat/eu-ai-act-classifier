resource "aws_opensearch_domain" "search" {
  domain_name    = "${local.name_prefix}-search"
  engine_version = "OpenSearch_2.13"

  cluster_config {
    instance_type            = var.environment == "prod" ? "m7g.large.search" : "t3.small.search"
    instance_count           = var.environment == "prod" ? 3 : 1
    zone_awareness_enabled   = var.environment == "prod"
  }

  ebs_options {
    ebs_enabled = true
    volume_size = 50
  }

  encrypt_at_rest { enabled = true }
  node_to_node_encryption { enabled = true }

  domain_endpoint_options {
    enforce_https       = true
    tls_security_policy = "Policy-Min-TLS-1-2-2019-07"
  }
}
