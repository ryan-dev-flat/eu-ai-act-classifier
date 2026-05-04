resource "aws_db_subnet_group" "primary" {
  name       = "${local.name_prefix}-db-subnets"
  subnet_ids = module.vpc.database_subnets
}

resource "aws_security_group" "rds" {
  name   = "${local.name_prefix}-rds"
  vpc_id = module.vpc.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.cluster_primary_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "primary" {
  identifier              = "${local.name_prefix}-primary"
  engine                  = "postgres"
  engine_version          = "16.4"
  instance_class          = var.rds_instance_class
  allocated_storage       = 100
  storage_encrypted       = true
  multi_az                = var.environment == "prod"
  db_name                 = "classifier"
  username                = "classifier"
  manage_master_user_password = true
  db_subnet_group_name    = aws_db_subnet_group.primary.name
  vpc_security_group_ids  = [aws_security_group.rds.id]
  backup_retention_period = 14
  deletion_protection     = var.environment == "prod"
  skip_final_snapshot     = var.environment != "prod"
}
