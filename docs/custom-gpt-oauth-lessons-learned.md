# Custom GPT OAuth Integration - Lessons Learned

## Overview
This document summarizes the challenges encountered when attempting to integrate Custom GPT with Supabase using OAuth 2.0 authentication.

## Original Goal
Enable Custom GPT to authenticate users via Google OAuth through Supabase, allowing the GPT to make authenticated API calls to the Uzo Food Tracking application.

## Architecture Attempted

### Approach 1: Direct Supabase OAuth Integration
**Initial Plan:**
- Custom GPT → Supabase Google OAuth → Custom GPT receives tokens
- Use Supabase's built-in Google OAuth provider
- Custom GPT would receive JWT tokens for authenticated API calls

**Why It Failed:**
- Custom GPT requires standard OAuth 2.0 authorization code flow
- Needed custom OAuth endpoints (authorize, token) to proxy between Custom GPT and Supabase
- Supabase's native OAuth endpoints don't match Custom GPT's expected OAuth flow

### Approach 2: Edge Function OAuth Proxy
**Architecture:**
```
Custom GPT → oauth-authorize Edge Function → Supabase Google Auth
          ← oauth-token Edge Function ← Supabase callback
```

**Implementation:**
- Created `oauth-authorize`: Redirects Custom GPT to Supabase Google OAuth
- Created `oauth-token`: Exchanges Supabase auth codes for JWT tokens
- Configured Custom GPT to use these endpoints

**Critical Issues Encountered:**

#### Issue 1: Supabase Implicit Flow vs Authorization Code Flow
**Problem:** Supabase consistently returned tokens in URL fragment (`#access_token=...`) instead of authorization code in query string (`?code=...`)

**Root Cause:**
- Supabase's `/auth/v1/authorize` endpoint uses implicit/PKCE flow by default
- Even with same-domain redirects, Supabase treats external OAuth flows with implicit flow
- The redirect URL allowlist controls whether redirects are allowed, NOT which OAuth flow is used

**Evidence:**
```
Expected: ...oauth-callback-handler?code=AUTH_CODE&state=...
Actual:   ...oauth-callback-handler?...#access_token=JWT&expires_at=...
```

**Attempted Solutions:**
1. ✗ Added callback handler to redirect allowlist (no effect on flow type)
2. ✗ Used wildcard patterns in allowlist (still implicit flow)
3. ✗ Created intermediate oauth-callback-handler function (still received implicit flow tokens)
4. ✗ Configured both GPT callback URLs in allowlist (no change)

#### Issue 2: Edge Function Authentication Requirements
**Problem:** Edge functions returned 401 "Missing authorization header" even for OAuth endpoints

**Solution Found:**
- Deploy functions with `--no-verify-jwt` flag
- Add `verify_jwt = false` to `functions/config.toml`
- OAuth endpoints must be publicly accessible (no authentication required)

**Status:** ✓ Resolved

#### Issue 3: Multiple GPT IDs Confusion
**Problem:** Testing with wrong GPT ID in redirect URLs

**Evidence:**
- Redirect allowlist had: `g-a63fd800d0e78437fca2b2af084b4683bef239c3`
- Actual GPT editor URL: `g-68e6c7b5553c81918c175e6007fba503`
- OAuth requests used the wrong GPT ID

**Solution:** Identified both GPT IDs and added correct URLs to allowlist

**Status:** ✓ Resolved (but didn't fix implicit flow issue)

#### Issue 4: Environment Variable Naming
**Problem:** Initial code used `SUPABASE_URL` but Edge Functions reserve `SUPABASE_` prefix

**Solution:** Used custom prefixes:
- `SUPA_UZO_FOOD_URL`
- `SUPA_UZO_FOOD_ANON_KEY`
- `UZO_FOOD_GPT_OAUTH_CLIENT_ID`
- `UZO_FOOD_GPT_OAUTH_CLIENT_SECRET`

**Status:** ✓ Resolved

## Why The Integration Failed

### Fundamental Incompatibility
**Supabase's OAuth Behavior:**
- Supabase's Google OAuth is designed for browser-based applications
- Uses implicit/PKCE flow for security (tokens in URL fragment)
- Not designed to be proxied through custom OAuth servers
- No documented way to force authorization code flow for external OAuth providers

**Custom GPT's Requirements:**
- Requires standard OAuth 2.0 authorization code flow
- Expects `?code=...` in query string (not `#access_token=...` in fragment)
- Cannot access URL fragments (server-side only)
- Token exchange must happen via `/token` endpoint

**The Mismatch:**
- Edge Functions cannot access URL fragments (browser-only via JavaScript)
- Supabase won't send authorization codes for external OAuth providers
- No configuration option to force authorization code flow
- Creating intermediate handlers doesn't change Supabase's flow selection

## Attempted Workarounds Considered (Not Implemented)

### Option 1: HTML/JavaScript Fragment Extraction
- Serve HTML page from oauth-callback-handler
- Use JavaScript to extract tokens from `window.location.hash`
- Send tokens to server endpoint to generate custom code
- Redirect to Custom GPT with custom code

**Drawbacks:** Complex, requires state management, non-standard

### Option 2: Custom Code Mapping System
- Store mapping of generated codes to access tokens
- Generate UUID codes when receiving implicit flow tokens
- Store in database/cache with short TTL
- Look up tokens during exchange

**Drawbacks:** Requires database storage, state management, complex

### Option 3: Accept Implicit Flow Tokens Directly
- Try passing access_token directly to Custom GPT
- Skip code exchange entirely

**Drawbacks:** Violates OAuth 2.0 spec, Custom GPT likely rejects it

## Lessons Learned

### Technical Lessons
1. **Supabase OAuth is designed for direct browser integration**, not for proxying through custom OAuth servers
2. **URL fragments are browser-only** - server-side proxies cannot access `#` content
3. **Redirect allowlists control authorization, not OAuth flow type** in Supabase
4. **Edge Functions must explicitly disable JWT verification** for public endpoints
5. **Testing OAuth flows requires understanding exact GPT IDs** and callback URLs

### Architectural Lessons
1. **OAuth proxying is complex** when upstream provider uses non-standard flows
2. **Implicit flow and authorization code flow are fundamentally incompatible** without client-side JavaScript
3. **Custom GPT OAuth integration requires** providers that natively support authorization code flow
4. **Supabase's OAuth is optimized for first-party apps**, not third-party integrations

### Process Lessons
1. **Validate OAuth flow compatibility early** before building proxy infrastructure
2. **Test with actual provider behavior** rather than assuming configuration controls flow
3. **Document all GPT IDs and callback URLs** to avoid confusion
4. **Check provider documentation** for OAuth flow configuration options

## Alternative Approaches for Custom GPT Integration

### Option 1: API Key Authentication (Simplest)
- Custom GPT uses API key authentication instead of OAuth
- User provides their Supabase JWT token directly to GPT
- No OAuth flow needed

**Pros:** Simple, works immediately
**Cons:** User must manually obtain and provide JWT token, less secure

### Option 2: Custom OAuth Server (Not Using Supabase)
- Build separate OAuth server using Auth0, Firebase Auth, or custom solution
- This OAuth server handles Google login independently
- Issues tokens that Custom GPT can use with Supabase RLS

**Pros:** Full control over OAuth flow
**Cons:** Additional infrastructure, complexity, cost

### Option 3: Supabase Auth + Manual Token Sharing
- User authenticates to Uzo Food Tracking web app via Supabase
- App displays JWT token for user to copy
- User provides token to Custom GPT as API key

**Pros:** Uses existing Supabase auth, simple for users
**Cons:** Manual token copying, tokens expire

### Option 4: No Authentication (Public API)
- Make Custom GPT API calls use anonymous access
- RLS policies allow limited public read access
- Users must be logged into web app for full features

**Pros:** No OAuth complexity
**Cons:** Limited functionality, potential security concerns

## Recommendation

**Use API Key Authentication** as the pragmatic solution:
- Have users authenticate via Supabase in the web app
- Provide a "Copy API Token" button in settings
- Users paste this token into Custom GPT configuration
- Token is a valid Supabase JWT that works with RLS policies

**Why This Works:**
- Leverages existing Supabase authentication
- No custom OAuth infrastructure needed
- Users maintain full control over access
- Can revoke access by logging out/changing password
- Simple for both developers and users

## Conclusion

Custom GPT OAuth integration with Supabase failed due to fundamental incompatibility between Supabase's implicit OAuth flow and Custom GPT's authorization code flow requirements. Supabase's OAuth is designed for direct browser-based integration, not for proxying through custom OAuth servers. The recommended solution is to use API key authentication with manual JWT token sharing from the web application.
