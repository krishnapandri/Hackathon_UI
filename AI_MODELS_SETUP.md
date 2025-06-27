# Free AI Models Setup Guide

Your Query Builder now supports multiple AI models, including completely free options that don't require any API keys.

## Currently Available Models

### ✅ Ready to Use (No Setup Required)
- **Groq Llama 3.3 70B** - Fast, high-quality SQL generation (your current model)
- **Local Template Generator** - Rule-based SQL generation (completely free, no API required)

### 🆓 Free Models (Require API Keys)

#### Hugging Face Models
Get a free API key at: https://huggingface.co/settings/tokens

Add to your environment:
```
HUGGINGFACE_API_KEY=your_token_here
```

Available models:
- **Llama 2 7B Chat** - Meta's Llama 2 model
- **Mistral 7B Instruct** - Mistral instruction model
- **DialoGPT Large** - Microsoft conversational model

#### OpenRouter Models
Get a free API key at: https://openrouter.ai/keys

Add to your environment:
```
OPENROUTER_API_KEY=your_key_here
```

Available free models:
- **Phi-3 Mini 4K** - Microsoft's efficient model
- **Llama 3.2 3B** - Latest Llama model
- **Qwen 2 7B** - Alibaba's multilingual model

## How to Use

1. Go to the **AI Query Builder** tab
2. Look for the **AI Model** selector below the query input
3. Choose any available model from the dropdown
4. Models are marked as:
   - 🟢 **Available** - Ready to use
   - 🔴 **API Key Required** - Need to add the API key first
   - 🆓 **Free** - No cost to use

## Model Recommendations

- **For Production**: Groq Llama 3.3 70B (fastest, most reliable)
- **For Testing/Learning**: Local Template Generator (always works, no internet required)
- **For Experimentation**: Any Hugging Face model (completely free with API key)

## Fallback System

If a model fails, the system automatically falls back to the Local Template Generator, ensuring your queries always work.