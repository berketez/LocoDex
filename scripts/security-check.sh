#!/bin/bash

# LocoDex Security Validation Script
# Checks for common security issues before deployment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🔐 LocoDex Security Validation"
echo "================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SECURITY_ISSUES=0

check_failed() {
    echo -e "${RED}❌ $1${NC}"
    ((SECURITY_ISSUES++))
}

check_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

check_passed() {
    echo -e "${GREEN}✅ $1${NC}"
}

echo ""
echo "1. Checking Environment Configuration..."

# Check if .env exists and has secure values
if [ ! -f "$PROJECT_DIR/.env" ]; then
    check_warning ".env file not found - using defaults from docker-compose.yml"
else
    # Check for default/insecure passwords
    if grep -q "REPLACE_WITH_SECURE" "$PROJECT_DIR/.env"; then
        check_failed "Default placeholder passwords found in .env file"
    else
        check_passed "No placeholder passwords found in .env"
    fi
    
    # Check for the specific insecure password mentioned in the issue
    if grep -q "dyRKKhelKOBAV8oX5RRMX" "$PROJECT_DIR/.env"; then
        check_failed "Known insecure password found in .env file"
    else
        check_passed "No known insecure passwords found"
    fi
fi

echo ""
echo "2. Checking Docker Configuration..."

# Check docker-compose.yml for hardcoded secrets
if grep -q "admin" "$PROJECT_DIR/docker-compose.yml" | grep -v "GF_SECURITY_ADMIN_USER"; then
    check_warning "Hardcoded 'admin' found in docker-compose.yml - verify it's using env vars"
fi

# Check if monitoring services are using environment variables
if grep -q "\${GF_SECURITY_ADMIN_PASSWORD" "$PROJECT_DIR/docker-compose.yml"; then
    check_passed "Grafana using environment variables for passwords"
else
    check_failed "Grafana not using environment variables for passwords"
fi

echo ""
echo "3. Checking Sandbox Security..."

# Check if sandbox has proper isolation
if grep -q "internal: true" "$PROJECT_DIR/docker-compose.yml"; then
    check_passed "Sandbox network isolation enabled"
else
    check_failed "Sandbox network isolation not found"
fi

# Check for proper capability dropping
if grep -q "cap_drop:" "$PROJECT_DIR/docker-compose.yml"; then
    check_passed "Container capabilities properly restricted"
else
    check_warning "Container capability restrictions not found"
fi

echo ""
echo "4. Checking File Permissions..."

# Check for world-writable files
WORLD_WRITABLE=$(find "$PROJECT_DIR" -type f -perm -o+w 2>/dev/null | grep -v ".git" | grep -v "node_modules" | head -5)
if [ ! -z "$WORLD_WRITABLE" ]; then
    check_warning "World-writable files found (first 5 shown):"
    echo "$WORLD_WRITABLE"
else
    check_passed "No world-writable files found"
fi

echo ""
echo "5. Checking for Sensitive Data in Git..."

# Check if this is a git repository
if [ -d "$PROJECT_DIR/.git" ]; then
    # Check if .env is properly ignored
    if git check-ignore "$PROJECT_DIR/.env" >/dev/null 2>&1; then
        check_passed ".env file is properly ignored by git"
    else
        check_failed ".env file is NOT ignored by git - risk of committing secrets"
    fi

    # Check for any committed secrets
    POTENTIAL_SECRETS=$(git log --all -p | grep -i -E "(password|secret|key|token)" | grep -E "^[\+\-]" | head -3)
    if [ ! -z "$POTENTIAL_SECRETS" ]; then
        check_warning "Potential secrets found in git history (manual review needed)"
    else
        check_passed "No obvious secrets found in git history"
    fi
else
    check_passed "Not a git repository - .env file commit risk does not apply"
fi

echo ""
echo "6. Generating Security Recommendations..."

echo ""
echo "📋 Pre-deployment Security Checklist:"
echo "======================================"

echo "Environment Setup:"
echo "  □ Generate secure Redis password: openssl rand -base64 32"
echo "  □ Set strong Grafana admin password (min 12 chars)"
echo "  □ Generate secure Grafana secret key: openssl rand -base64 32"
echo "  □ Review all API keys and tokens"

echo ""
echo "Network Security:"
echo "  □ Ensure only necessary ports are exposed"
echo "  □ Use HTTPS in production"
echo "  □ Configure proper firewall rules"
echo "  □ Enable container network isolation"

echo ""
echo "Access Control:"
echo "  □ Change default usernames where possible"
echo "  □ Use strong passwords (min 12 chars, mixed case, numbers, symbols)"
echo "  □ Enable 2FA where available"
echo "  □ Regular password rotation"

echo ""
echo "Monitoring:"
echo "  □ Enable audit logging"
echo "  □ Set up monitoring alerts"
echo "  □ Regular security scans"
echo "  □ Backup encryption keys securely"

echo ""
echo "================================"
if [ $SECURITY_ISSUES -eq 0 ]; then
    echo -e "${GREEN}🎉 Security check passed! No critical issues found.${NC}"
    echo "You can proceed with deployment after completing the checklist above."
    exit 0
elif [ $SECURITY_ISSUES -le 2 ]; then
    echo -e "${YELLOW}⚠️  Security check completed with $SECURITY_ISSUES warning(s).${NC}"
    echo "Please address the issues above before deployment."
    exit 1
else
    echo -e "${RED}🚨 SECURITY CHECK FAILED! $SECURITY_ISSUES critical issue(s) found.${NC}"
    echo "DO NOT DEPLOY until all security issues are resolved!"
    exit 2
fi