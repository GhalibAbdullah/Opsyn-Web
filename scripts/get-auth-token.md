# How to Get Your Auth Token

## Method 1: Browser DevTools (Easiest)

1. **Open your Activepieces app** in the browser (e.g., `http://localhost:4200`)
2. **Press F12** to open DevTools
3. **Go to the Network tab**
4. **Make any API request** (e.g., navigate to a page that loads data)
5. **Click on any API request** in the Network tab
6. **Look at the Request Headers** section
7. **Find the `Authorization` header** - it will look like:
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
8. **Copy the entire value** (including "Bearer ")

## Method 2: Browser Local Storage

1. **Open DevTools (F12)**
2. **Go to Application tab** (Chrome) or **Storage tab** (Firefox)
3. **Click on Local Storage** → your domain
4. **Look for keys** like:
   - `token`
   - `auth_token`
   - `access_token`
   - `ap_token`
   - Or any key containing "token" or "auth"
5. **Copy the value**

## Method 3: Check Cookies

1. **Open DevTools (F12)**
2. **Go to Application tab** → **Cookies**
3. **Look for cookies** containing "token" or "auth"
4. **Copy the value**

## Method 4: From API Response

1. **Open DevTools (F12)** → **Network tab**
2. **Log in** to your Activepieces instance
3. **Look for login/auth API calls**
4. **Check the response** - it might contain a token

## Using the Token

Once you have the token, use it like this:

```bash
# Make sure to include "Bearer " prefix if it's not already there
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
     "http://localhost:3000/v1/project-members?projectId=TVmzIolrHNfKYNs4QFpWS"
```

Or use the test script:

```bash
chmod +x scripts/test-members-api.sh
./scripts/test-members-api.sh "Bearer YOUR_TOKEN_HERE"
```

