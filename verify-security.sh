#!/bin/bash

# Security Verification Script
# Run this to verify all security features are properly implemented

echo "🔒 Security Implementation Verification"
echo "========================================\n"

# Check 1: Packages installed
echo "✓ Checking security packages..."
if grep -q '"helmet"' package.json && grep -q '"express-rate-limit"' package.json; then
  echo "  ✅ Helmet.js and express-rate-limit installed"
else
  echo "  ❌ Missing security packages"
fi

# Check 2: Middleware files exist
echo "\n✓ Checking middleware files..."
if [ -f "src/middleware/security.ts" ]; then
  echo "  ✅ src/middleware/security.ts exists"
else
  echo "  ❌ src/middleware/security.ts missing"
fi

if [ -f "src/middleware/validation.ts" ]; then
  echo "  ✅ src/middleware/validation.ts exists"
else
  echo "  ❌ src/middleware/validation.ts missing"
fi

# Check 3: Config has security settings
echo "\n✓ Checking config settings..."
if grep -q "security:" src/config/index.ts; then
  echo "  ✅ Security config added to index.ts"
else
  echo "  ❌ Security config missing from index.ts"
fi

# Check 4: Server uses security middleware
echo "\n✓ Checking server.ts integration..."
if grep -q "helmetMiddleware" src/api/server.ts; then
  echo "  ✅ Helmet middleware integrated"
else
  echo "  ❌ Helmet middleware not found"
fi

if grep -q "corsOptions" src/api/server.ts; then
  echo "  ✅ CORS configuration integrated"
else
  echo "  ❌ CORS configuration not found"
fi

if grep -q "validateApiKey" src/api/server.ts; then
  echo "  ✅ API key validation integrated"
else
  echo "  ❌ API key validation not found"
fi

# Check 5: Validation middleware
echo "\n✓ Checking validation middleware..."
if grep -q "validateEmail" src/middleware/validation.ts; then
  echo "  ✅ Email validation implemented"
else
  echo "  ❌ Email validation missing"
fi

if grep -q "validateCustomerInfo" src/middleware/validation.ts; then
  echo "  ✅ Customer info validation implemented"
else
  echo "  ❌ Customer info validation missing"
fi

# Check 6: Error sanitization
echo "\n✓ Checking error sanitization..."
if grep -q "maskSensitiveData" src/api/server.ts; then
  echo "  ✅ Error sanitization implemented"
else
  echo "  ❌ Error sanitization missing"
fi

# Check 7: Documentation
echo "\n✓ Checking documentation..."
if [ -f "SECURITY.md" ]; then
  echo "  ✅ SECURITY.md documentation exists"
else
  echo "  ❌ SECURITY.md missing"
fi

if [ -f "SECURITY_CHANGES.md" ]; then
  echo "  ✅ SECURITY_CHANGES.md exists"
else
  echo "  ❌ SECURITY_CHANGES.md missing"
fi

if [ -f "SECURITY_QUICK_START.md" ]; then
  echo "  ✅ SECURITY_QUICK_START.md exists"
else
  echo "  ❌ SECURITY_QUICK_START.md missing"
fi

# Check 8: Environment variables updated
echo "\n✓ Checking environment configuration..."
if grep -q "API_KEY" env.example; then
  echo "  ✅ API_KEY added to env.example"
else
  echo "  ❌ API_KEY missing from env.example"
fi

if grep -q "ALLOWED_ORIGINS" env.example; then
  echo "  ✅ ALLOWED_ORIGINS added to env.example"
else
  echo "  ❌ ALLOWED_ORIGINS missing from env.example"
fi

# Check 9: TypeScript compilation
echo "\n✓ Checking TypeScript compilation..."
if npm run build > /dev/null 2>&1; then
  echo "  ✅ TypeScript compiles successfully"
else
  echo "  ❌ TypeScript compilation errors"
  npm run build
fi

echo "\n========================================"
echo "🎉 Security verification complete!"
echo "\nNext steps:"
echo "1. Update .env with API_KEY and ALLOWED_ORIGINS"
echo "2. Test endpoints with API key header:"
echo "   curl http://localhost:3000/queue/info -H \"X-API-Key: your-key\""
echo "3. Read SECURITY_QUICK_START.md for detailed usage"
echo ""
