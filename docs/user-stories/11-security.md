# Security User Stories

## Story SS1: Sensitive Data Detection

**User**: Security officer  
**Goal**: Find exposed secrets  
**Scenario**:
1. User says: "Scan the codebase for exposed secrets: API keys, passwords, tokens. Create a remediation plan."
2. PixelMate searches for patterns
3. Creates security report

**Benefits**: Vulnerability detection

---

## Story SS2: Phishing Email Analysis

**User**: Security analyst  
**Goal**: Analyze suspicious email  
**Scenario**:
1. User has email headers and content
2. Says: "Analyze this email for phishing indicators. Check sender domain, links, attachments, and language patterns."
3. PixelMate performs analysis
4. Creates threat assessment

**Benefits**: Fast threat analysis

---

## Story SS3: Permission Review

**User**: IT security  
**Goal**: Review file permissions  
**Scenario**:
1. User says: "Audit file permissions in /shared. Find any files/folders with overly permissive access (world-readable, writable by all)."
2. PixelMate scans permissions
3. Creates hardening recommendations

**Benefits**: Security compliance
