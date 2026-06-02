# System Prompt for Claude: Build isclaudeup.com

You are an expert full-stack web developer and system architect. Your task is to help me build the MVP for a viral "Is It Down" utility site called **isclaudeup.com**, which tracks the status of Claude AI and Claude Code. 

I have already purchased the domain, linked it to a public GitHub repo, set up GitHub Pages (tracking the `main` branch), and configured the DNS records. The infrastructure must remain lightweight, serverless, and highly cost-controlled to prevent unexpected billing spikes if the site goes viral during an outage.
I just need you to create the website and I can push and it's live.

Please provide the necessary HTML, CSS, client-side JavaScript, and backend serverless code based on the exact specifications below.

## 1. Tech Stack & Infrastructure
* **Frontend:** Pure HTML, CSS, and vanilla client-side JavaScript. 
* **Hosting:** GitHub Pages (already deployed).
* **Backend/API (The Smash Counter):** Cloudflare Workers (free tier) or Supabase. **CRITICAL:** I need strict rate limiting and configuration instructions to ensure I cannot be billed for overages if spammed or DDoSed.
* **Status Check:** A cron job/serverless function that pings Claude's public endpoint every 5 minutes.
* **Email Collection:** Brevo (using an embedded HTML form or simple API call for the free tier).
* **Monetization:** Google AdSense (provide a placeholder script block in the `<head>`).

## 2. UI/UX & Layout Requirements
The design must be responsive, clean, and focus entirely on the core utility. 

* **The Big TV (Status Indicator):** A massive, unmistakable `YES` (Red background/theme, meaning it IS down) or `NO` (Green background/theme, meaning it is NOT down) block at the top.
* **The Mascot:** A fair-use, minimalist stylized robot Claude symbol. It should visually change state based on the status (e.g., broken/glitching if down, smiling/operational if up).
* **The "Smash" Button:** A highly satisfying, large button that says "Check Again". People love to mash buttons when they are stressed.
* **Funny Quote Generator:** Directly under the smash button. Every time the button is clicked, a new quote appears via client-side JS. Examples: 
    * *"My assignment is due tomorrow and I just started."*
    * *"If Claude goes down, so does my productivity and service."*
* **Fallout Counter:** A dynamic counter displaying the number of people who have smashed the button in the last 24 hours.
* **The Newsletter Hook:** Directly under the status/counter, an embedded Brevo signup form. Copy: *"Get an email the second it comes back up so you can get back to work."*

## 3. Application Logic
Please provide the code broken down into these actionable steps:

### Step 1: The Static Frontend (`index.html`, `style.css`, `script.js`)
* Create the layout with the Big TV status, the Robot Mascot, the Smash button, and the Brevo embed.
* Include the Google AdSense placeholder snippet.
* Write the JS to handle the button smash animation, cycling through the funny quotes array, and updating the local counter state optimistically.

### Step 2: The Smash Counter Backend (Serverless)
* Write a Cloudflare Worker script (or Supabase edge function) that accepts a POST request from the frontend to increment the click count.
* Explain exactly how to set a hard usage cap or rate limit to protect my wallet.
* The API needs to return the count for the "last 24 hours".

### Step 3: The True Status Cron Job
* Provide a script (e.g., a scheduled Cloudflare Worker) that checks Claude's status endpoint every 5 minutes.
* If it returns a 500-series error or times out, it should update a key-value store to toggle the frontend's main status to YES (It's Down).

Can it use the existing official https://status.claude.com/ source too?

Please output the code blocks clearly so I can commit them directly to my GitHub repository and push to `main`.
