# ChatGPT API Integration Guide

## Security Model Overview

This app uses a **two-tier access model** for maximum security and flexibility:

| Access Type | Key Used | Authentication Required | RLS Applied | Use Case |
|-------------|----------|------------------------|-------------|----------|
| **Web UI** | ANON key | ✅ Yes (email/password) | ✅ Yes (after auth) | Regular users |
| **API/ChatGPT** | Service Role key | ❌ No | ❌ Bypassed | External integrations |

## Getting Your Service Role Key

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `amehiertzqtbtcjhugql`
3. Navigate to **Settings** → **API**
4. Find **Service Role** key (starts with `eyJ...`)
5. **⚠️ NEVER share this publicly or commit to git**

Current key from your `.env`:
```
Service Role: sb_secret_kfeDh39fZHmQVTZt7D_ssg_5R7VJUHI
```

## ChatGPT Custom GPT Setup

### 1. Create Custom GPT Action

In your Custom GPT configuration, add this OpenAPI schema:

```yaml
openapi: 3.1.0
info:
  title: Food Tracking API
  version: 1.0.0
  description: Personal food tracking and recipe management API

servers:
  - url: https://amehiertzqtbtcjhugql.supabase.co/rest/v1
    description: Supabase REST API

components:
  securitySchemes:
    ServiceRoleAuth:
      type: apiKey
      in: header
      name: apikey
    BearerAuth:
      type: http
      scheme: bearer

security:
  - ServiceRoleAuth: []
    BearerAuth: []

paths:
  /recipes:
    get:
      summary: Get all recipes
      operationId: getRecipes
      parameters:
        - name: select
          in: query
          schema:
            type: string
          description: Fields to select (e.g., "*" for all)
      responses:
        '200':
          description: List of recipes

  /items:
    get:
      summary: Get all food items
      operationId: getItems
      responses:
        '200':
          description: List of food items

  /meal_logs:
    get:
      summary: Get meal logs
      operationId: getMealLogs
      responses:
        '200':
          description: List of meal logs
    post:
      summary: Create a meal log
      operationId: createMealLog
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                meal_name:
                  type: string
                eaten_on:
                  type: string
                  format: date-time
      responses:
        '201':
          description: Meal log created
```

### 2. Configure Authentication

In the Custom GPT **Authentication** section:

1. **Authentication Type**: API Key
2. **API Key**: `sb_secret_kfeDh39fZHmQVTZt7D_ssg_5R7VJUHI`
3. **Auth Type**: Custom
4. **Custom Header Name**: `apikey`

**Also add Bearer token:**
5. Add second header: `Authorization: Bearer sb_secret_kfeDh39fZHmQVTZt7D_ssg_5R7VJUHI`

### 3. Test Your Integration

Ask ChatGPT:
```
"Show me all my recipes"
"What did I eat yesterday?"
"Add a meal log for chicken stir-fry"
```

## Direct API Usage (cURL)

### Get All Recipes
```bash
curl 'https://amehiertzqtbtcjhugql.supabase.co/rest/v1/recipes?select=*' \
  -H "apikey: sb_secret_kfeDh39fZHmQVTZt7D_ssg_5R7VJUHI" \
  -H "Authorization: Bearer sb_secret_kfeDh39fZHmQVTZt7D_ssg_5R7VJUHI"
```

### Get Food Items
```bash
curl 'https://amehiertzqtbtcjhugql.supabase.co/rest/v1/items?select=*' \
  -H "apikey: sb_secret_kfeDh39fZHmQVTZt7D_ssg_5R7VJUHI" \
  -H "Authorization: Bearer sb_secret_kfeDh39fZHmQVTZt7D_ssg_5R7VJUHI"
```

### Create Meal Log
```bash
curl -X POST 'https://amehiertzqtbtcjhugql.supabase.co/rest/v1/meal_logs' \
  -H "apikey: sb_secret_kfeDh39fZHmQVTZt7D_ssg_5R7VJUHI" \
  -H "Authorization: Bearer sb_secret_kfeDh39fZHmQVTZt7D_ssg_5R7VJUHI" \
  -H "Content-Type: application/json" \
  -d '{
    "meal_name": "Chicken Stir-Fry",
    "eaten_on": "2025-10-07T18:00:00Z"
  }'
```

## Security Best Practices

### ✅ DO:
- Store Service Role key in ChatGPT secrets (never in prompts)
- Use Service Role key only for personal/trusted integrations
- Keep the key out of version control
- Rotate the key if accidentally exposed

### ❌ DON'T:
- Share Service Role key publicly
- Commit Service Role key to git
- Use Service Role key in client-side JavaScript
- Give Service Role key to untrusted users

## How RLS Bypass Works

**Service Role Key** has special privileges in Supabase:
- Automatically bypasses ALL RLS policies
- Has full database access (CREATE, READ, UPDATE, DELETE)
- Acts as a "superuser" for the database

**ANON Key** respects RLS policies:
- Must authenticate to access data
- Subject to `auth.uid() IS NOT NULL` checks
- Safe to expose in frontend code

## Troubleshooting

### "permission denied for table X"
- You're using ANON key instead of Service Role key
- Solution: Use the `sb_secret_*` key, not `sb_publishable_*` key

### "JWT expired" or "invalid JWT"
- Service Role keys don't expire, but check if you're using the correct key
- Solution: Copy fresh Service Role key from Supabase dashboard

### "No rows returned"
- Check your Supabase project URL is correct
- Verify data exists in the database
- Check Supabase logs for detailed errors

## Single User Configuration

If you want to restrict the web UI to a single email (your email only):

1. Go to **Supabase Dashboard** → **Authentication** → **Providers**
2. Disable **Email signup** (only allow sign-in)
3. Manually create your user account via dashboard
4. Result: Only you can access the web UI, but Service Role key still works

This ensures:
- ✅ Web UI = Your personal account only
- ✅ API access = Works for ChatGPT/integrations
- ✅ No one else can create accounts
