# Quick Fix: Clear Schema Cache and Deploy Migrations (Windows PowerShell)

Write-Host "🔧 Fixing schema cache error for discipline_referrals..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Link to Supabase project
Write-Host "Step 1: Linking to Supabase project..." -ForegroundColor Yellow
Write-Host "Run this command and follow the prompts:"
Write-Host ""
Write-Host "  supabase link --project-ref YOUR_PROJECT_REF" -ForegroundColor White
Write-Host ""
Write-Host "You can find YOUR_PROJECT_REF in your Supabase dashboard URL:" -ForegroundColor Gray
Write-Host "  https://supabase.com/dashboard/projects/[YOUR_PROJECT_REF]" -ForegroundColor Gray
Write-Host ""
Read-Host "Press Enter after linking"

# Step 2: Push migrations
Write-Host ""
Write-Host "Step 2: Deploying migrations to Supabase..." -ForegroundColor Yellow
supabase db push

# Step 3: Pull schema (clears cache)
Write-Host ""
Write-Host "Step 3: Pulling schema and clearing cache..." -ForegroundColor Yellow
supabase db pull --linked

Write-Host ""
Write-Host "✅ Schema cache cleared!" -ForegroundColor Green
Write-Host ""
Write-Host "Step 4: Restart your development server" -ForegroundColor Yellow
Write-Host "  1. Stop the current server (Ctrl+C)"
Write-Host "  2. Run: npm run dev"
Write-Host ""
