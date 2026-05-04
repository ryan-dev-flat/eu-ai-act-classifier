variable "environment" {
  description = "Deployment environment (dev | staging | prod)."
  type        = string
}

variable "aws_region" {
  description = "Primary AWS region. EU-West-1 default for GDPR data residency."
  type        = string
  default     = "eu-west-1"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.40.0.0/16"
}

variable "eks_cluster_version" {
  description = "EKS Kubernetes version."
  type        = string
  default     = "1.30"
}

variable "rds_instance_class" {
  description = "RDS PostgreSQL instance class."
  type        = string
  default     = "db.t4g.medium"
}

variable "tags" {
  description = "Tags applied to every resource."
  type        = map(string)
  default = {
    Project = "eu-ai-act-classifier"
  }
}
