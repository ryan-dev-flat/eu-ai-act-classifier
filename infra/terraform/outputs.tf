output "vpc_id" {
  value = module.vpc.vpc_id
}

output "eks_cluster_name" {
  value = module.eks.cluster_name
}

output "rds_endpoint" {
  value     = aws_db_instance.primary.endpoint
  sensitive = true
}

output "redis_primary_endpoint" {
  value     = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive = true
}

output "documents_bucket" {
  value = aws_s3_bucket.documents.bucket
}

output "opensearch_endpoint" {
  value = aws_opensearch_domain.search.endpoint
}
