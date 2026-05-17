#!/bin/bash
# Quick Fix: Clear Schema Cache and Deploy Migrations

echo "🔧 Fixing schema cache error for discipline_referrals..."
echo ""

# Step 1: Link to Supabase project
echo "Step 1: Linking to Supabase project..."
echo "Run this command and follow the prompts:"
echo ""
echo "  supabase link --project-ref YOUR_PROJECT_REF"
echo ""
echo "You can find YOUR_PROJECT_REF in your Supabase dashboard URL:"
echo "  https://supabase.com/dashboard/projects/[YOUR_PROJECT_REF]"
echo ""
read -p "Press Enter after linking..."

# Step 2: Push migrations
echo ""
echo "Step 2: Deploying migrations to Supabase..."
supabase db push

# Step 3: Pull schema (clears cache)
echo ""
echo "Step 3: Pulling schema and clearing cache..."
supabase db pull --linked

echo ""
echo "✅ Schema cache cleared!"
echo ""
echo "Step 4: Restart your development server"
echo "  1. Stop the current server (Ctrl+C)"
echo "  2. Run: npm run dev"
echo ""
