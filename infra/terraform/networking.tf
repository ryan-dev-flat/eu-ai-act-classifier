# VPC + subnets via the upstream module. Three AZs for RDS Multi-AZ and EKS.
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.13"

  name = "${local.name_prefix}-vpc"
  cidr = var.vpc_cidr

  azs              = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  public_subnets   = ["10.40.0.0/20", "10.40.16.0/20", "10.40.32.0/20"]
  private_subnets  = ["10.40.48.0/20", "10.40.64.0/20", "10.40.80.0/20"]
  database_subnets = ["10.40.96.0/24", "10.40.97.0/24", "10.40.98.0/24"]

  enable_nat_gateway     = true
  single_nat_gateway     = var.environment != "prod"
  one_nat_gateway_per_az = var.environment == "prod"

  enable_dns_hostnames = true
  enable_dns_support   = true
}
