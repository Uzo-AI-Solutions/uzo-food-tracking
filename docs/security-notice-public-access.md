# Security Notice: Public Database Access

## Current Security Model

**Date Implemented:** October 12, 2025
**Status:** Row Level Security (RLS) **DISABLED**

## What This Means

The database is now **publicly accessible** to anyone with the anon key:
- ✅ Anyone can read ALL data
- ✅ Anyone can write/modify ALL data
- ✅ Anyone can delete ALL data
- ⚠️ No user isolation or data protection

## Security Through Obscurity

**Only barrier:** The anon key itself

**How the key can be discovered:**
1. Open browser DevTools on the website
2. Go to Network tab
3. Inspect API requests to Supabase
4. View the `apikey` header value
5. Use that key to access the database directly

**Reality Check:**
- The anon key is visible in the client-side bundle
- Anyone with basic web development knowledge can find it
- The key is effectively public once the site is deployed

## Why This Is Acceptable (For Now)

✅ **Personal prototype** - you're the only user
✅ **MVP/testing phase** - focus on functionality first
✅ **Time constraints** - need to move forward
✅ **Future migration path** - can add auth later
✅ **Pragmatic decision** - security vs. progress trade-off

## What This Enables

### For Custom GPT
- ✅ Read all nutrition data and analytics
- ✅ Add new recipes and meals
- ✅ Update existing entries
- ✅ Delete items
- ✅ Full CRUD operations without authentication

### For Web Application
- ✅ Simplified data access (no auth logic needed)
- ✅ Faster development (no user session management)
- ✅ Works immediately without login flow

## Risks

### If Anon Key is Discovered

**Low-Impact Scenarios:**
- Someone views your nutrition data (embarrassing but not critical)
- Someone adds fake recipes (annoying, easily cleaned up)
- Someone modifies meal logs (data integrity issue)

**Medium-Impact Scenarios:**
- Someone deletes all your data (need backups)
- Someone floods database with junk data (performance impact)
- Bot scraping/indexing your data (privacy concern)

**High-Impact Scenarios:**
- Database used for malicious purposes (legal/reputational risk)
- Service abuse leading to quota/billing issues (financial cost)
- Data exfiltration and public sharing (privacy violation)

## Mitigation Strategies

### Implemented
- ✅ **Backups**: Supabase automatic backups enabled
- ✅ **Rate limiting**: Supabase default rate limits on anon key
- ✅ **Monitoring**: Can check Supabase usage dashboard

### Recommended (Future)
- 🔄 **IP allowlist**: Restrict anon key to known IPs (Supabase Pro feature)
- 🔄 **CAPTCHA**: Add CAPTCHA to write operations on web app
- 🔄 **Auth implementation**: Add proper authentication when ready
- 🔄 **API gateway**: Add rate limiting layer before Supabase
- 🔄 **Data validation**: Strict schema validation on write operations

## Migration Path Back to Secure

When you're ready to add authentication:

### Option 1: Supabase Auth (Recommended)
```sql
-- Re-enable RLS
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Add user-based policies
CREATE POLICY "Users see own data" ON items
    FOR ALL TO authenticated
    USING (auth.uid() = user_id);
```

Then add login UI to web app using Supabase Auth.

### Option 2: Custom Auth + RLS
Build your own auth system and modify RLS policies to check your custom user table.

### Option 3: API Layer
Keep database public but add authenticated API layer in between (more complex).

## Current OpenAPI Configuration

The Custom GPT is configured with:
- **Authentication:** API Key
- **Key:** Supabase anon key
- **Header:** `apikey`
- **Access:** Full read/write to all tables

## Monitoring Recommendations

### Daily Checks (During Active Use)
1. Check Supabase usage dashboard for unusual activity
2. Verify data integrity (no unauthorized modifications)
3. Monitor request volume for spikes

### Weekly Checks
1. Review Supabase logs for suspicious patterns
2. Check database size (detect data flooding)
3. Verify backups are current

### Alerts to Set Up (If Available)
- Database size threshold alerts
- Request rate spike alerts
- Error rate increase alerts

## Acceptance Criteria

**This security model is acceptable IF:**
- ✅ You're the only user
- ✅ Data is not sensitive/private
- ✅ You have regular backups
- ✅ You can restore from backup if needed
- ✅ You plan to add proper auth later
- ✅ Financial risk from abuse is minimal

**You should ADD AUTHENTICATION if:**
- ❌ Multiple users need access
- ❌ Data is sensitive or private
- ❌ Compliance/legal requirements exist
- ❌ Public exposure would cause significant harm
- ❌ Monetary loss from abuse is unacceptable

## Documentation References

- [Custom GPT OAuth Lessons Learned](./custom-gpt-oauth-lessons-learned.md)
- [Custom GPT Architecture Limitations](./custom-gpt-architecture-limitations.md)
- [Migration File](../supabase/migrations/20251012_002_disable_rls_for_public_access.sql)

## Conclusion

This is a **pragmatic prototype decision** accepting security trade-offs for development velocity. The current security model is "good enough" for a personal project but should not be used for:
- Multi-user applications
- Production applications
- Applications with sensitive data
- Public-facing products

When you're ready to scale or make this production-ready, implement proper authentication and re-enable RLS.

---

**Status:** Active
**Next Review:** When adding multi-user support or going to production
**Owner:** Personal project
**Risk Level:** Low-Medium (acceptable for prototype)
