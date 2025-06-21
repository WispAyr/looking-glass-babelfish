#!/bin/bash

# Babelfish Looking Glass Environment Setup Script
# ===============================================

echo "🚀 Babelfish Looking Glass Environment Setup"
echo "============================================"
echo ""

# Check if .env already exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists!"
    read -p "Do you want to backup the existing .env file? (y/n): " backup_choice
    
    if [[ $backup_choice =~ ^[Yy]$ ]]; then
        backup_file=".env.backup.$(date +%Y%m%d_%H%M%S)"
        cp .env "$backup_file"
        echo "✅ Existing .env backed up to: $backup_file"
    fi
    
    read -p "Do you want to overwrite the existing .env file? (y/n): " overwrite_choice
    
    if [[ ! $overwrite_choice =~ ^[Yy]$ ]]; then
        echo "❌ Setup cancelled. No changes made."
        exit 0
    fi
fi

# Copy the complete environment file
if [ -f "env.complete" ]; then
    cp env.complete .env
    echo "✅ Environment file created: .env"
    echo ""
    echo "📝 Next steps:"
    echo "1. Edit .env with your actual values"
    echo "2. Update API keys and credentials"
    echo "3. Configure your UniFi Protect settings"
    echo "4. Set up external service keys (OpenAI, Telegram, etc.)"
    echo ""
    echo "🔧 Key settings to update:"
    echo "   - UNIFI_API_KEY: Your UniFi Protect API key"
    echo "   - UNIFI_HOST: Your UniFi Protect NVR IP address"
    echo "   - OPENAI_API_KEY: Your OpenAI API key (for LLM features)"
    echo "   - TELEGRAM_BOT_TOKEN: Your Telegram bot token"
    echo "   - SESSION_SECRET: A random secret for session management"
    echo ""
    echo "🚀 Ready to start: npm run setup"
else
    echo "❌ Error: env.complete file not found!"
    exit 1
fi 