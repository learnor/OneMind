#!/usr/bin/env node

/**
 * Environment Configuration Checker
 * 检查 OneMind 项目所需的环境变量配置
 */

const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkEnvFile() {
  log('\n🔍 OneMind 环境配置检查器', 'bright');
  log('================================', 'cyan');

  const envPath = path.join(process.cwd(), '.env');
  const envExamplePath = path.join(process.cwd(), '.env.example');

  // 检查 .env 文件是否存在
  if (!fs.existsSync(envPath)) {
    log('❌ 未找到 .env 文件', 'red');
    
    if (fs.existsSync(envExamplePath)) {
      log('💡 发现 .env.example 文件，正在复制...', 'yellow');
      fs.copyFileSync(envExamplePath, envPath);
      log('✅ 已创建 .env 文件，请填入你的配置信息', 'green');
    } else {
      log('❌ 也未找到 .env.example 文件', 'red');
      return false;
    }
  }

  // 读取环境变量
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = envContent.split('\n').reduce((acc, line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        acc[key.trim()] = valueParts.join('=').trim();
      }
    }
    return acc;
  }, {});

  log('\n📋 检查环境变量:', 'cyan');

  // 必需的环境变量
  const requiredVars = [
    {
      name: 'EXPO_PUBLIC_SUPABASE_URL',
      description: 'Supabase 项目 URL',
      validator: (value) => value && value.startsWith('https://') && !value.includes('your-project'),
    },
    {
      name: 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
      description: 'Supabase 匿名访问密钥',
      validator: (value) => value && value.length > 30 && !value.includes('your-anon-key') && !value.includes('your-anon-key-here'),
    },
    {
      name: 'EXPO_PUBLIC_GEMINI_API_KEY',
      description: 'Google Gemini API 密钥',
      validator: (value) => value && value.length > 20 && !value.includes('your-gemini-api-key'),
    },
  ];

  let allValid = true;

  requiredVars.forEach(({ name, description, validator }) => {
    const value = envVars[name];
    const isValid = validator(value);
    
    if (isValid) {
      log(`  ✅ ${name}`, 'green');
    } else {
      log(`  ❌ ${name} - ${description}`, 'red');
      if (!value) {
        log(`     未设置此变量`);
      } else {
        log(`     当前值: ${value.substring(0, 20)}${value.length > 20 ? '...' : ''}`);
      }
      allValid = false;
    }
  });

  // 可选的环境变量
  const optionalVars = [
    {
      name: 'EXPO_PUBLIC_OPENAI_API_KEY',
      description: 'OpenAI API 密钥（可选，用于替代 Gemini）',
    },
  ];

  log('\n📝 可选环境变量:', 'cyan');
  optionalVars.forEach(({ name, description }) => {
    const value = envVars[name];
    if (value && !value.includes('your-openai-key')) {
      log(`  ✅ ${name}`, 'green');
    } else {
      log(`  ⭕ ${name} - ${description}`, 'yellow');
    }
  });

  // 总结
  log('\n📊 配置总结:', 'cyan');
  if (allValid) {
    log('🎉 所有必需的环境变量都已正确配置！', 'green');
    log('\n🚀 接下来你可以:', 'cyan');
    log('  1. 运行 npm start 启动开发服务器');
    log('  2. 测试语音录制和拍照功能');
    log('  3. 检查 AI 是否能正确处理输入');
    return true;
  } else {
    log('⚠️  请完善上述配置后重新运行检查', 'yellow');
    log('\n📖 获取帮助:', 'cyan');
    log('  1. Supabase: 访问 https://supabase.com 创建项目');
    log('  2. Gemini API: 访问 https://ai.google.dev 获取 API 密钥');
    log('  3. 复制示例配置到 .env 文件并填入真实值');
    return false;
  }
}

function showUsage() {
  log('\n💡 使用方法:', 'cyan');
  log('  node check-env.js          # 检查环境配置');
  log('  node check-env.js --setup   # 自动创建 .env 文件');
}

// 主程序
function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showUsage();
    return;
  }

  checkEnvFile();
}

if (require.main === module) {
  main();
}

module.exports = { checkEnvFile };