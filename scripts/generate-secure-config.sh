#!/bin/bash

# LocoDex Secure Configuration Generator
# Generates secure passwords and updates .env file

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"

echo "🔐 Generating Secure Configuration for LocoDex"
echo "=============================================="

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if openssl is available
if ! command -v openssl &> /dev/null; then
    echo -e "${RED}❌ OpenSSL not found. Please install OpenSSL first.${NC}"
    exit 1
fi

# Backup existing .env
if [ -f "$ENV_FILE" ]; then
    echo "📋 Backing up existing .env file..."
    cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
    echo -e "${GREEN}✅ Backup created${NC}"
fi

echo ""
echo "🔑 Generating secure passwords..."

# Generate secure passwords
REDIS_PASSWORD=$(openssl rand -base64 32)
GRAFANA_PASSWORD=$(openssl rand -base64 24)  # More readable length for manual entry
GRAFANA_SECRET=$(openssl rand -base64 32)

echo "Generated passwords:"
echo "  - Redis password: ${REDIS_PASSWORD:0:8}..."
echo "  - Grafana password: ${GRAFANA_PASSWORD:0:8}..."
echo "  - Grafana secret: ${GRAFANA_SECRET:0:8}..."

echo ""
echo "📝 Updating .env file..."

# Update .env file with secure values
sed -i.bak \
    -e "s/REDIS_PASSWORD=.*/REDIS_PASSWORD=$REDIS_PASSWORD/" \
    -e "s/GF_SECURITY_ADMIN_PASSWORD=.*/GF_SECURITY_ADMIN_PASSWORD=$GRAFANA_PASSWORD/" \
    -e "s/GF_SECURITY_SECRET_KEY=.*/GF_SECURITY_SECRET_KEY=$GRAFANA_SECRET/" \
    "$ENV_FILE"

echo -e "${GREEN}✅ .env file updated with secure passwords${NC}"

echo ""
echo "🔒 Security Information"
echo "======================"
echo ""
echo "IMPORTANT: Save these credentials securely!"
echo ""
echo "Redis Password: $REDIS_PASSWORD"
echo "Grafana Admin User: admin"
echo "Grafana Admin Password: $GRAFANA_PASSWORD"
echo ""
echo -e "${YELLOW}⚠️  Store these credentials in a secure password manager${NC}"
echo -e "${YELLOW}⚠️  Change the Grafana admin password after first login${NC}"

echo ""
echo "✅ Secure configuration generated successfully!"
echo ""
echo "Next steps:"
echo "1. Run: ./scripts/security-check.sh"
echo "2. Review all settings in .env file"
echo "3. Test the deployment in a secure environment"
echo "4. Change default usernames where possible"

# Set restrictive permissions on .env
chmod 600 "$ENV_FILE"
echo -e "${GREEN}✅ Set restrictive permissions on .env file (600)${NC}"