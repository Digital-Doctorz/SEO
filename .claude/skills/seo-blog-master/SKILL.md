---
name: seo-blog-master
description: Master SEO blog/article creation rules. Always use when writing, generating, or redrafting blog posts or articles in this project.
---

# SEO Blog Master Skill

## Canonical prompt location

**Always load and follow:**

`prompts/SEO-BLOG-MASTER-PROMPT.md`

This is the single source of truth for blog and article writing in this product.

## When to apply

- Any request to write, generate, redraft, or enhance a blog post or article
- `/api/generate-blog` and any future content-generation routes
- Agent-assisted content work for this SEO app

## Runtime behavior (app)

1. Map inputs: TOPIC, KEYWORD, WORDCOUNT (≥2000), AUDIENCE, TONE (Conversational | Professional | Academic), COMPETITOR_URL, BRAND, TARGET_URL
2. Run research → outline → write → FAQ → takeaways → audit **internally** (no interactive checkpoints required in API mode)
3. Ground content in live target-URL crawl when available
4. On redraft: full enhance rewrite under the same master rules
5. Include media placeholders: `[IMAGE:…]`, `[CHART:bar …]`, markdown tables
6. Output app JSON schema defined at the bottom of the master prompt file

## Do not

- Bypass tone, density, or formatting rules
- Use banned phrases from the master prompt
- Invent fake study DOIs or exact fake survey percentages
- Produce thin bullet-only articles (prose must dominate)
