// Ready-made task workflows for the departments, kept here so the Task types page can install and
// set them up with the same calls the workflow builder and the Task types page make. Nothing installs
// by itself: an administrator presses "Set up". The same list went to the backend team for
// workflow_templates.py (FBOS_NEW_WORKFLOW_TEMPLATES.py); a template the server already lists is
// skipped here.
// `home` is the team that does the work (matched by name, confirmed by the person setting up);
// `teams` names stages that belong to another team. A template has no team field of its own, so
// the setup form writes each stage's team into the first published version.
export const DEPARTMENT_WORKFLOWS = [
  {
    "code": "seo-audit",
    "name": "SEO audit",
    "discipline": "digital_marketing",
    "summary": "Crawl the site, analyse it, write the findings, and have them reviewed.",
    "stages": [
      {
        "code": "crawling",
        "name": "Website crawling",
        "stage_type": "start",
        "status_category": "open"
      },
      {
        "code": "technical",
        "name": "Technical analysis",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "onpage",
        "name": "On-page analysis",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "findings",
        "name": "Findings",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "review",
        "name": "Review",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "completed",
        "name": "Completed",
        "stage_type": "end",
        "status_category": "done"
      },
      {
        "code": "dropped",
        "name": "Dropped",
        "stage_type": "end",
        "status_category": "cancelled"
      }
    ],
    "steps": [
      {
        "code": "start",
        "name": "Start crawling",
        "from": "crawling",
        "to": "technical"
      },
      {
        "code": "drop",
        "name": "Drop",
        "from": "crawling",
        "to": "dropped"
      },
      {
        "code": "to_onpage",
        "name": "Technical done",
        "from": "technical",
        "to": "onpage"
      },
      {
        "code": "to_findings",
        "name": "On-page done",
        "from": "onpage",
        "to": "findings"
      },
      {
        "code": "hand_in",
        "name": "Hand in for review",
        "from": "findings",
        "to": "review"
      },
      {
        "code": "send_back",
        "name": "Send back",
        "from": "review",
        "to": "findings"
      },
      {
        "code": "approve",
        "name": "Approve",
        "from": "review",
        "to": "completed"
      }
    ],
    "home": "SEO"
  },
  {
    "code": "seo-keyword-research",
    "name": "Keyword research",
    "discipline": "digital_marketing",
    "summary": "Research, competitor analysis and keyword mapping, approved before use.",
    "stages": [
      {
        "code": "research",
        "name": "Research",
        "stage_type": "start",
        "status_category": "open"
      },
      {
        "code": "competitors",
        "name": "Competitor analysis",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "mapping",
        "name": "Keyword mapping",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "review",
        "name": "Review",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "approved",
        "name": "Approved",
        "stage_type": "end",
        "status_category": "done"
      },
      {
        "code": "dropped",
        "name": "Dropped",
        "stage_type": "end",
        "status_category": "cancelled"
      }
    ],
    "steps": [
      {
        "code": "start",
        "name": "Start research",
        "from": "research",
        "to": "competitors"
      },
      {
        "code": "drop",
        "name": "Drop",
        "from": "research",
        "to": "dropped"
      },
      {
        "code": "to_mapping",
        "name": "Competitors done",
        "from": "competitors",
        "to": "mapping"
      },
      {
        "code": "hand_in",
        "name": "Hand in for review",
        "from": "mapping",
        "to": "review"
      },
      {
        "code": "send_back",
        "name": "Send back",
        "from": "review",
        "to": "mapping"
      },
      {
        "code": "approve",
        "name": "Approve",
        "from": "review",
        "to": "approved"
      }
    ],
    "home": "SEO"
  },
  {
    "code": "seo-on-page",
    "name": "On-page SEO",
    "discipline": "digital_marketing",
    "summary": "Pick the page, map keywords, optimise, review, implement and verify.",
    "stages": [
      {
        "code": "page",
        "name": "Page selection",
        "stage_type": "start",
        "status_category": "open"
      },
      {
        "code": "mapping",
        "name": "Keyword mapping",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "optimising",
        "name": "Optimisation",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "review",
        "name": "Review",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "implementing",
        "name": "Implementation",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "verifying",
        "name": "Verification",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "completed",
        "name": "Completed",
        "stage_type": "end",
        "status_category": "done"
      },
      {
        "code": "dropped",
        "name": "Dropped",
        "stage_type": "end",
        "status_category": "cancelled"
      }
    ],
    "steps": [
      {
        "code": "start",
        "name": "Start",
        "from": "page",
        "to": "mapping"
      },
      {
        "code": "drop",
        "name": "Drop",
        "from": "page",
        "to": "dropped"
      },
      {
        "code": "to_optimise",
        "name": "Keywords mapped",
        "from": "mapping",
        "to": "optimising"
      },
      {
        "code": "hand_in",
        "name": "Hand in for review",
        "from": "optimising",
        "to": "review"
      },
      {
        "code": "send_back",
        "name": "Send back",
        "from": "review",
        "to": "optimising"
      },
      {
        "code": "approve",
        "name": "Approve",
        "from": "review",
        "to": "implementing"
      },
      {
        "code": "implemented",
        "name": "Implemented",
        "from": "implementing",
        "to": "verifying"
      },
      {
        "code": "not_live",
        "name": "Not live yet",
        "from": "verifying",
        "to": "implementing"
      },
      {
        "code": "verified",
        "name": "Verified",
        "from": "verifying",
        "to": "completed"
      }
    ],
    "home": "SEO"
  },
  {
    "code": "seo-technical",
    "name": "Technical SEO",
    "discipline": "digital_marketing",
    "summary": "Find the issue, plan the fix, fix it (SEO or Development), test and verify.",
    "stages": [
      {
        "code": "identified",
        "name": "Issue identified",
        "stage_type": "start",
        "status_category": "open"
      },
      {
        "code": "analysis",
        "name": "Analysis",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "planning",
        "name": "Fix planning",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "dev_assist",
        "name": "Development assistance",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "implementing",
        "name": "Implementation",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "dev_testing",
        "name": "Testing",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "seo_verify",
        "name": "SEO verification",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "review",
        "name": "Review",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "completed",
        "name": "Completed",
        "stage_type": "end",
        "status_category": "done"
      },
      {
        "code": "dropped",
        "name": "Dropped",
        "stage_type": "end",
        "status_category": "cancelled"
      }
    ],
    "steps": [
      {
        "code": "start",
        "name": "Start analysis",
        "from": "identified",
        "to": "analysis"
      },
      {
        "code": "drop",
        "name": "Drop",
        "from": "identified",
        "to": "dropped"
      },
      {
        "code": "to_plan",
        "name": "Analysis done",
        "from": "analysis",
        "to": "planning"
      },
      {
        "code": "seo_fix",
        "name": "SEO fixes it directly",
        "from": "planning",
        "to": "implementing"
      },
      {
        "code": "needs_dev",
        "name": "Needs development",
        "from": "planning",
        "to": "dev_assist"
      },
      {
        "code": "dev_done",
        "name": "Development done",
        "from": "dev_assist",
        "to": "dev_testing"
      },
      {
        "code": "seo_done",
        "name": "Fix done",
        "from": "implementing",
        "to": "dev_testing"
      },
      {
        "code": "test_failed",
        "name": "Test failed",
        "from": "dev_testing",
        "to": "implementing"
      },
      {
        "code": "tested",
        "name": "Tested",
        "from": "dev_testing",
        "to": "seo_verify"
      },
      {
        "code": "not_fixed",
        "name": "Not fixed",
        "from": "seo_verify",
        "to": "implementing"
      },
      {
        "code": "verified",
        "name": "Verified",
        "from": "seo_verify",
        "to": "review"
      },
      {
        "code": "send_back",
        "name": "Send back",
        "from": "review",
        "to": "implementing"
      },
      {
        "code": "approve",
        "name": "Approve",
        "from": "review",
        "to": "completed"
      }
    ],
    "teams": {
      "dev_assist": "Development",
      "dev_testing": "Development"
    },
    "home": "SEO"
  },
  {
    "code": "seo-off-page",
    "name": "Off-page SEO",
    "discipline": "digital_marketing",
    "summary": "Find prospects, check their quality, reach out, follow up, verify the link and report.",
    "stages": [
      {
        "code": "research",
        "name": "Prospect research",
        "stage_type": "start",
        "status_category": "open"
      },
      {
        "code": "quality",
        "name": "Quality assessment",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "outreach",
        "name": "Outreach",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "followup",
        "name": "Follow-up",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "verifying",
        "name": "Verification",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "reporting",
        "name": "Reporting",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "completed",
        "name": "Completed",
        "stage_type": "end",
        "status_category": "done"
      },
      {
        "code": "dropped",
        "name": "Dropped",
        "stage_type": "end",
        "status_category": "cancelled"
      }
    ],
    "steps": [
      {
        "code": "start",
        "name": "Start research",
        "from": "research",
        "to": "quality"
      },
      {
        "code": "drop",
        "name": "Drop",
        "from": "research",
        "to": "dropped"
      },
      {
        "code": "approved_prospect",
        "name": "Prospect is good",
        "from": "quality",
        "to": "outreach"
      },
      {
        "code": "reject_prospect",
        "name": "Not suitable",
        "from": "quality",
        "to": "dropped"
      },
      {
        "code": "sent",
        "name": "Outreach sent",
        "from": "outreach",
        "to": "followup"
      },
      {
        "code": "link_live",
        "name": "Link is live",
        "from": "followup",
        "to": "verifying"
      },
      {
        "code": "no_reply",
        "name": "No reply, try again",
        "from": "followup",
        "to": "outreach"
      },
      {
        "code": "not_live",
        "name": "Not live",
        "from": "verifying",
        "to": "followup"
      },
      {
        "code": "verified",
        "name": "Verified",
        "from": "verifying",
        "to": "reporting"
      },
      {
        "code": "reported",
        "name": "Reported",
        "from": "reporting",
        "to": "completed"
      }
    ],
    "home": "SEO"
  },
  {
    "code": "seo-content",
    "name": "SEO content",
    "discipline": "digital_marketing",
    "summary": "Topic, keywords, brief, writing, SEO review, approval and publishing.",
    "stages": [
      {
        "code": "topic",
        "name": "Topic",
        "stage_type": "start",
        "status_category": "open"
      },
      {
        "code": "keywords",
        "name": "Keyword research",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "brief",
        "name": "Content brief",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "writing",
        "name": "Writing",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "seo_review",
        "name": "SEO review",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "approval",
        "name": "Approval",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "publishing",
        "name": "Publishing",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "published",
        "name": "Published",
        "stage_type": "end",
        "status_category": "done"
      },
      {
        "code": "dropped",
        "name": "Dropped",
        "stage_type": "end",
        "status_category": "cancelled"
      }
    ],
    "steps": [
      {
        "code": "start",
        "name": "Start",
        "from": "topic",
        "to": "keywords"
      },
      {
        "code": "drop",
        "name": "Drop",
        "from": "topic",
        "to": "dropped"
      },
      {
        "code": "to_brief",
        "name": "Keywords ready",
        "from": "keywords",
        "to": "brief"
      },
      {
        "code": "to_writing",
        "name": "Brief ready",
        "from": "brief",
        "to": "writing"
      },
      {
        "code": "hand_in",
        "name": "Hand in for SEO review",
        "from": "writing",
        "to": "seo_review"
      },
      {
        "code": "send_back",
        "name": "Send back",
        "from": "seo_review",
        "to": "writing"
      },
      {
        "code": "seo_ok",
        "name": "SEO approved",
        "from": "seo_review",
        "to": "approval"
      },
      {
        "code": "rework",
        "name": "Needs changes",
        "from": "approval",
        "to": "writing"
      },
      {
        "code": "approved",
        "name": "Approved",
        "from": "approval",
        "to": "publishing"
      },
      {
        "code": "publish",
        "name": "Published",
        "from": "publishing",
        "to": "published"
      }
    ],
    "teams": {
      "writing": "Content Writing"
    },
    "home": "SEO"
  },
  {
    "code": "seo-reporting",
    "name": "SEO report",
    "discipline": "digital_marketing",
    "summary": "Collect data, analyse rankings and traffic, prepare, review and submit to the client.",
    "stages": [
      {
        "code": "collect",
        "name": "Data collection",
        "stage_type": "start",
        "status_category": "open"
      },
      {
        "code": "ranking",
        "name": "Ranking analysis",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "traffic",
        "name": "Traffic analysis",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "preparing",
        "name": "Report preparation",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "review",
        "name": "Review",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "submitted",
        "name": "Submitted to client",
        "stage_type": "end",
        "status_category": "done"
      },
      {
        "code": "dropped",
        "name": "Dropped",
        "stage_type": "end",
        "status_category": "cancelled"
      }
    ],
    "steps": [
      {
        "code": "start",
        "name": "Start",
        "from": "collect",
        "to": "ranking"
      },
      {
        "code": "drop",
        "name": "Drop",
        "from": "collect",
        "to": "dropped"
      },
      {
        "code": "to_traffic",
        "name": "Rankings done",
        "from": "ranking",
        "to": "traffic"
      },
      {
        "code": "to_report",
        "name": "Traffic done",
        "from": "traffic",
        "to": "preparing"
      },
      {
        "code": "hand_in",
        "name": "Hand in for review",
        "from": "preparing",
        "to": "review"
      },
      {
        "code": "send_back",
        "name": "Send back",
        "from": "review",
        "to": "preparing"
      },
      {
        "code": "submit",
        "name": "Submit to client",
        "from": "review",
        "to": "submitted"
      }
    ],
    "home": "SEO"
  },
  {
    "code": "social-media-post",
    "name": "Social media post",
    "discipline": "digital_marketing",
    "summary": "Caption, design and marketing checks, client approval, then scheduled, published and verified.",
    "stages": [
      {
        "code": "requirement",
        "name": "Requirement",
        "stage_type": "start",
        "status_category": "open"
      },
      {
        "code": "caption",
        "name": "Caption writing",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "content_review",
        "name": "Content review",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "design",
        "name": "Graphic design",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "design_review",
        "name": "Design review",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "marketing_review",
        "name": "Marketing review",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "client_approval",
        "name": "Client approval",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "scheduling",
        "name": "Scheduling",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "publishing",
        "name": "Publishing",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "verifying",
        "name": "Verification",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "completed",
        "name": "Completed",
        "stage_type": "end",
        "status_category": "done"
      },
      {
        "code": "dropped",
        "name": "Dropped",
        "stage_type": "end",
        "status_category": "cancelled"
      }
    ],
    "steps": [
      {
        "code": "start",
        "name": "Start caption",
        "from": "requirement",
        "to": "caption"
      },
      {
        "code": "drop",
        "name": "Drop",
        "from": "requirement",
        "to": "dropped"
      },
      {
        "code": "caption_done",
        "name": "Caption ready",
        "from": "caption",
        "to": "content_review"
      },
      {
        "code": "caption_changes",
        "name": "Caption needs changes",
        "from": "content_review",
        "to": "caption"
      },
      {
        "code": "content_ok",
        "name": "Content approved",
        "from": "content_review",
        "to": "design"
      },
      {
        "code": "design_done",
        "name": "Design ready",
        "from": "design",
        "to": "design_review"
      },
      {
        "code": "design_changes",
        "name": "Design needs changes",
        "from": "design_review",
        "to": "design"
      },
      {
        "code": "design_ok",
        "name": "Design approved",
        "from": "design_review",
        "to": "marketing_review"
      },
      {
        "code": "marketing_changes",
        "name": "Marketing wants changes",
        "from": "marketing_review",
        "to": "design"
      },
      {
        "code": "needs_client",
        "name": "Send to client",
        "from": "marketing_review",
        "to": "client_approval"
      },
      {
        "code": "no_client",
        "name": "No client approval needed",
        "from": "marketing_review",
        "to": "scheduling"
      },
      {
        "code": "client_changes",
        "name": "Client wants changes",
        "from": "client_approval",
        "to": "design"
      },
      {
        "code": "client_ok",
        "name": "Client approved",
        "from": "client_approval",
        "to": "scheduling"
      },
      {
        "code": "scheduled",
        "name": "Scheduled",
        "from": "scheduling",
        "to": "publishing"
      },
      {
        "code": "published",
        "name": "Published",
        "from": "publishing",
        "to": "verifying"
      },
      {
        "code": "not_live",
        "name": "Not live",
        "from": "verifying",
        "to": "publishing"
      },
      {
        "code": "verified",
        "name": "Verified",
        "from": "verifying",
        "to": "completed"
      }
    ],
    "teams": {
      "caption": "Content Writing",
      "content_review": "Content Writing",
      "design": "Graphic Design",
      "design_review": "Graphic Design",
      "marketing_review": "Social Media",
      "scheduling": "Social Media",
      "publishing": "Social Media"
    },
    "home": "Social Media"
  },
  {
    "code": "google-ads",
    "name": "Google Ads campaign",
    "discipline": "digital_marketing",
    "summary": "Research, strategy, budget approval, setup, tracking check, launch, monitor and report.",
    "stages": [
      {
        "code": "requirement",
        "name": "Requirement",
        "stage_type": "start",
        "status_category": "open"
      },
      {
        "code": "research",
        "name": "Research",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "strategy",
        "name": "Strategy",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "budget",
        "name": "Budget approval",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "setup",
        "name": "Campaign setup",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "creative",
        "name": "Creative",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "tracking",
        "name": "Tracking verification",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "review",
        "name": "Review",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "launched",
        "name": "Launched, monitoring",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "reporting",
        "name": "Optimisation and reporting",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "completed",
        "name": "Completed",
        "stage_type": "end",
        "status_category": "done"
      },
      {
        "code": "dropped",
        "name": "Dropped",
        "stage_type": "end",
        "status_category": "cancelled"
      }
    ],
    "steps": [
      {
        "code": "start",
        "name": "Start research",
        "from": "requirement",
        "to": "research"
      },
      {
        "code": "drop",
        "name": "Drop",
        "from": "requirement",
        "to": "dropped"
      },
      {
        "code": "to_strategy",
        "name": "Research done",
        "from": "research",
        "to": "strategy"
      },
      {
        "code": "to_budget",
        "name": "Strategy ready",
        "from": "strategy",
        "to": "budget"
      },
      {
        "code": "budget_no",
        "name": "Budget not approved",
        "from": "budget",
        "to": "strategy"
      },
      {
        "code": "budget_ok",
        "name": "Budget approved",
        "from": "budget",
        "to": "setup"
      },
      {
        "code": "needs_creative",
        "name": "Needs creative",
        "from": "setup",
        "to": "creative"
      },
      {
        "code": "creative_done",
        "name": "Creative ready",
        "from": "creative",
        "to": "setup"
      },
      {
        "code": "to_tracking",
        "name": "Setup done",
        "from": "setup",
        "to": "tracking"
      },
      {
        "code": "tracking_bad",
        "name": "Tracking not working",
        "from": "tracking",
        "to": "setup"
      },
      {
        "code": "tracking_ok",
        "name": "Tracking verified",
        "from": "tracking",
        "to": "review"
      },
      {
        "code": "send_back",
        "name": "Send back",
        "from": "review",
        "to": "setup"
      },
      {
        "code": "launch",
        "name": "Launch",
        "from": "review",
        "to": "launched"
      },
      {
        "code": "to_report",
        "name": "Monitoring done",
        "from": "launched",
        "to": "reporting"
      },
      {
        "code": "optimise",
        "name": "Needs optimisation",
        "from": "reporting",
        "to": "launched"
      },
      {
        "code": "reported",
        "name": "Reported",
        "from": "reporting",
        "to": "completed"
      }
    ],
    "teams": {
      "creative": "Graphic Design"
    },
    "home": "Google Ads"
  },
  {
    "code": "meta-ads",
    "name": "Meta Ads campaign",
    "discipline": "digital_marketing",
    "summary": "Audience research, strategy, creative, setup, review, launch, optimise and report.",
    "stages": [
      {
        "code": "requirement",
        "name": "Requirement",
        "stage_type": "start",
        "status_category": "open"
      },
      {
        "code": "audience",
        "name": "Audience research",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "strategy",
        "name": "Strategy",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "creative",
        "name": "Creative production",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "setup",
        "name": "Campaign setup",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "review",
        "name": "Review",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "launched",
        "name": "Launched, optimising",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "reporting",
        "name": "Reporting",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "completed",
        "name": "Completed",
        "stage_type": "end",
        "status_category": "done"
      },
      {
        "code": "dropped",
        "name": "Dropped",
        "stage_type": "end",
        "status_category": "cancelled"
      }
    ],
    "steps": [
      {
        "code": "start",
        "name": "Start research",
        "from": "requirement",
        "to": "audience"
      },
      {
        "code": "drop",
        "name": "Drop",
        "from": "requirement",
        "to": "dropped"
      },
      {
        "code": "to_strategy",
        "name": "Audience ready",
        "from": "audience",
        "to": "strategy"
      },
      {
        "code": "to_creative",
        "name": "Strategy ready",
        "from": "strategy",
        "to": "creative"
      },
      {
        "code": "to_setup",
        "name": "Creative ready",
        "from": "creative",
        "to": "setup"
      },
      {
        "code": "hand_in",
        "name": "Hand in for review",
        "from": "setup",
        "to": "review"
      },
      {
        "code": "send_back",
        "name": "Send back",
        "from": "review",
        "to": "setup"
      },
      {
        "code": "launch",
        "name": "Launch",
        "from": "review",
        "to": "launched"
      },
      {
        "code": "to_report",
        "name": "Optimisation done",
        "from": "launched",
        "to": "reporting"
      },
      {
        "code": "reported",
        "name": "Reported",
        "from": "reporting",
        "to": "completed"
      }
    ],
    "teams": {
      "creative": "Graphic Design"
    },
    "home": "Meta Ads"
  },
  {
    "code": "content-writing",
    "name": "Content writing",
    "discipline": "creative",
    "summary": "Research, outline, write, edit, review and approve before delivery or publishing.",
    "stages": [
      {
        "code": "requirement",
        "name": "Requirement",
        "stage_type": "start",
        "status_category": "open"
      },
      {
        "code": "research",
        "name": "Research",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "outline",
        "name": "Outline",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "writing",
        "name": "Writing",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "editing",
        "name": "Editing",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "review",
        "name": "Review",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "delivered",
        "name": "Delivered",
        "stage_type": "end",
        "status_category": "done"
      },
      {
        "code": "dropped",
        "name": "Dropped",
        "stage_type": "end",
        "status_category": "cancelled"
      }
    ],
    "steps": [
      {
        "code": "start",
        "name": "Start research",
        "from": "requirement",
        "to": "research"
      },
      {
        "code": "drop",
        "name": "Drop",
        "from": "requirement",
        "to": "dropped"
      },
      {
        "code": "to_outline",
        "name": "Research done",
        "from": "research",
        "to": "outline"
      },
      {
        "code": "to_write",
        "name": "Outline ready",
        "from": "outline",
        "to": "writing"
      },
      {
        "code": "to_edit",
        "name": "Draft ready",
        "from": "writing",
        "to": "editing"
      },
      {
        "code": "edit_back",
        "name": "Needs rewrite",
        "from": "editing",
        "to": "writing"
      },
      {
        "code": "to_review",
        "name": "Edited",
        "from": "editing",
        "to": "review"
      },
      {
        "code": "send_back",
        "name": "Send back",
        "from": "review",
        "to": "writing"
      },
      {
        "code": "approve",
        "name": "Approve and deliver",
        "from": "review",
        "to": "delivered"
      }
    ],
    "home": "Content Writing"
  },
  {
    "code": "department-handoff",
    "name": "Department handoff",
    "discipline": "sales",
    "summary": "After a deal is won: share the requirement with the delivery team and confirm they accepted it.",
    "stages": [
      {
        "code": "won",
        "name": "Deal won",
        "stage_type": "start",
        "status_category": "open"
      },
      {
        "code": "briefing",
        "name": "Preparing the handoff",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "accepting",
        "name": "Delivery team accepts",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "handed_over",
        "name": "Handed over",
        "stage_type": "end",
        "status_category": "done"
      },
      {
        "code": "dropped",
        "name": "Dropped",
        "stage_type": "end",
        "status_category": "cancelled"
      }
    ],
    "steps": [
      {
        "code": "start",
        "name": "Start handoff",
        "from": "won",
        "to": "briefing"
      },
      {
        "code": "drop",
        "name": "Drop",
        "from": "won",
        "to": "dropped"
      },
      {
        "code": "share",
        "name": "Share with the team",
        "from": "briefing",
        "to": "accepting"
      },
      {
        "code": "more_info",
        "name": "Needs more detail",
        "from": "accepting",
        "to": "briefing"
      },
      {
        "code": "accept",
        "name": "Team accepts",
        "from": "accepting",
        "to": "handed_over"
      }
    ],
    "home": "Sales"
  },
  {
    "code": "sales-follow-up",
    "name": "Client follow-up",
    "discipline": "sales",
    "summary": "A follow-up that is due, done, and its result recorded.",
    "stages": [
      {
        "code": "due",
        "name": "Follow-up due",
        "stage_type": "start",
        "status_category": "open"
      },
      {
        "code": "contacting",
        "name": "Contacting the client",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "recorded",
        "name": "Result recorded",
        "stage_type": "end",
        "status_category": "done"
      },
      {
        "code": "dropped",
        "name": "Dropped",
        "stage_type": "end",
        "status_category": "cancelled"
      }
    ],
    "steps": [
      {
        "code": "start",
        "name": "Start",
        "from": "due",
        "to": "contacting"
      },
      {
        "code": "drop",
        "name": "Drop",
        "from": "due",
        "to": "dropped"
      },
      {
        "code": "reschedule",
        "name": "Client asked to call later",
        "from": "contacting",
        "to": "due"
      },
      {
        "code": "record",
        "name": "Result recorded",
        "from": "contacting",
        "to": "recorded"
      }
    ],
    "home": "Sales"
  },
  {
    "code": "sales-meeting",
    "name": "Client meeting",
    "discipline": "sales",
    "summary": "Scheduled, held, requirements written down and checked by the sales head.",
    "stages": [
      {
        "code": "scheduled",
        "name": "Meeting scheduled",
        "stage_type": "start",
        "status_category": "open"
      },
      {
        "code": "meeting",
        "name": "Meeting",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "notes",
        "name": "Requirements and notes",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "review",
        "name": "Review",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "completed",
        "name": "Completed",
        "stage_type": "end",
        "status_category": "done"
      },
      {
        "code": "cancelled",
        "name": "Cancelled",
        "stage_type": "end",
        "status_category": "cancelled"
      }
    ],
    "steps": [
      {
        "code": "start",
        "name": "Start meeting",
        "from": "scheduled",
        "to": "meeting"
      },
      {
        "code": "cancel",
        "name": "Cancel",
        "from": "scheduled",
        "to": "cancelled"
      },
      {
        "code": "held",
        "name": "Meeting held",
        "from": "meeting",
        "to": "notes"
      },
      {
        "code": "hand_in",
        "name": "Hand in notes",
        "from": "notes",
        "to": "review"
      },
      {
        "code": "send_back",
        "name": "Send back",
        "from": "review",
        "to": "notes"
      },
      {
        "code": "approve",
        "name": "Approve",
        "from": "review",
        "to": "completed"
      }
    ],
    "home": "Sales"
  },
  {
    "code": "sales-renewal",
    "name": "Renewal",
    "discipline": "sales",
    "summary": "A renewal that is due: contact, quote, negotiate, confirm; or lost.",
    "stages": [
      {
        "code": "due",
        "name": "Renewal due",
        "stage_type": "start",
        "status_category": "open"
      },
      {
        "code": "contacting",
        "name": "Contacting the client",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "quotation",
        "name": "Quotation",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "negotiation",
        "name": "Negotiation",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "confirmation",
        "name": "Confirmation",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "renewed",
        "name": "Renewed",
        "stage_type": "end",
        "status_category": "done"
      },
      {
        "code": "lost",
        "name": "Lost",
        "stage_type": "end",
        "status_category": "cancelled"
      }
    ],
    "steps": [
      {
        "code": "start",
        "name": "Start",
        "from": "due",
        "to": "contacting"
      },
      {
        "code": "to_quote",
        "name": "Client wants to renew",
        "from": "contacting",
        "to": "quotation"
      },
      {
        "code": "not_renewing",
        "name": "Not renewing",
        "from": "contacting",
        "to": "lost"
      },
      {
        "code": "to_negotiate",
        "name": "Quotation sent",
        "from": "quotation",
        "to": "negotiation"
      },
      {
        "code": "revise",
        "name": "Revise quotation",
        "from": "negotiation",
        "to": "quotation"
      },
      {
        "code": "to_confirm",
        "name": "Agreed",
        "from": "negotiation",
        "to": "confirmation"
      },
      {
        "code": "fell_through",
        "name": "Fell through",
        "from": "negotiation",
        "to": "lost"
      },
      {
        "code": "reopen",
        "name": "Not confirmed yet",
        "from": "confirmation",
        "to": "negotiation"
      },
      {
        "code": "confirm",
        "name": "Confirmed",
        "from": "confirmation",
        "to": "renewed"
      }
    ],
    "home": "Sales"
  },
  {
    "code": "dev-project",
    "name": "Software project",
    "discipline": "software",
    "summary": "Requirement to handover: analysis, planning, design, build, code review, QA, client UAT and deployment.",
    "stages": [
      {
        "code": "requirement",
        "name": "Requirement",
        "stage_type": "start",
        "status_category": "open"
      },
      {
        "code": "analysis",
        "name": "Analysis",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "planning",
        "name": "Planning",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "design",
        "name": "Design",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "development",
        "name": "Development",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "code_review",
        "name": "Code review",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "qa",
        "name": "QA",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "uat",
        "name": "Client UAT",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "deployment",
        "name": "Deployment",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "handed_over",
        "name": "Handed over",
        "stage_type": "end",
        "status_category": "done"
      },
      {
        "code": "dropped",
        "name": "Dropped",
        "stage_type": "end",
        "status_category": "cancelled"
      }
    ],
    "steps": [
      {
        "code": "start",
        "name": "Start analysis",
        "from": "requirement",
        "to": "analysis"
      },
      {
        "code": "drop",
        "name": "Drop",
        "from": "requirement",
        "to": "dropped"
      },
      {
        "code": "to_plan",
        "name": "Analysis done",
        "from": "analysis",
        "to": "planning"
      },
      {
        "code": "to_design",
        "name": "Plan ready",
        "from": "planning",
        "to": "design"
      },
      {
        "code": "to_dev",
        "name": "Design approved",
        "from": "design",
        "to": "development"
      },
      {
        "code": "request_review",
        "name": "Request code review",
        "from": "development",
        "to": "code_review"
      },
      {
        "code": "review_changes",
        "name": "Request changes",
        "from": "code_review",
        "to": "development"
      },
      {
        "code": "to_qa",
        "name": "Code approved",
        "from": "code_review",
        "to": "qa"
      },
      {
        "code": "qa_failed",
        "name": "QA failed",
        "from": "qa",
        "to": "development"
      },
      {
        "code": "to_uat",
        "name": "QA passed",
        "from": "qa",
        "to": "uat"
      },
      {
        "code": "uat_changes",
        "name": "Client wants changes",
        "from": "uat",
        "to": "development"
      },
      {
        "code": "to_deploy",
        "name": "Client accepted",
        "from": "uat",
        "to": "deployment"
      },
      {
        "code": "handover",
        "name": "Deployed and handed over",
        "from": "deployment",
        "to": "handed_over"
      }
    ],
    "teams": {
      "qa": "QA"
    },
    "home": "Development"
  },
  {
    "code": "dev-feature",
    "name": "Feature with verification",
    "discipline": "software",
    "summary": "Requirement, development, code review, testing and verification before it is completed.",
    "stages": [
      {
        "code": "requirement",
        "name": "Requirement",
        "stage_type": "start",
        "status_category": "open"
      },
      {
        "code": "development",
        "name": "Development",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "code_review",
        "name": "Code review",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "testing",
        "name": "Testing",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "verification",
        "name": "Verification",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "completed",
        "name": "Completed",
        "stage_type": "end",
        "status_category": "done"
      },
      {
        "code": "dropped",
        "name": "Dropped",
        "stage_type": "end",
        "status_category": "cancelled"
      }
    ],
    "steps": [
      {
        "code": "start",
        "name": "Start development",
        "from": "requirement",
        "to": "development"
      },
      {
        "code": "drop",
        "name": "Drop",
        "from": "requirement",
        "to": "dropped"
      },
      {
        "code": "request_review",
        "name": "Request review",
        "from": "development",
        "to": "code_review"
      },
      {
        "code": "request_changes",
        "name": "Request changes",
        "from": "code_review",
        "to": "development"
      },
      {
        "code": "approve",
        "name": "Approve code",
        "from": "code_review",
        "to": "testing"
      },
      {
        "code": "failed",
        "name": "Failed testing",
        "from": "testing",
        "to": "development"
      },
      {
        "code": "tested",
        "name": "Tested",
        "from": "testing",
        "to": "verification"
      },
      {
        "code": "not_ok",
        "name": "Not as required",
        "from": "verification",
        "to": "development"
      },
      {
        "code": "verified",
        "name": "Verified",
        "from": "verification",
        "to": "completed"
      }
    ],
    "teams": {
      "testing": "QA"
    },
    "home": "Development"
  },
  {
    "code": "dev-bug",
    "name": "Bug with retest",
    "discipline": "software",
    "summary": "Reported, investigated, fixed, retested and verified before it is closed.",
    "stages": [
      {
        "code": "reported",
        "name": "Reported",
        "stage_type": "start",
        "status_category": "open"
      },
      {
        "code": "investigation",
        "name": "Investigation",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "fixing",
        "name": "Fixing",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "retesting",
        "name": "Retesting",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "verification",
        "name": "Verification",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "closed",
        "name": "Closed",
        "stage_type": "end",
        "status_category": "done"
      },
      {
        "code": "wont_fix",
        "name": "Won't fix",
        "stage_type": "end",
        "status_category": "cancelled"
      }
    ],
    "steps": [
      {
        "code": "start",
        "name": "Start investigating",
        "from": "reported",
        "to": "investigation"
      },
      {
        "code": "decline",
        "name": "Won't fix",
        "from": "reported",
        "to": "wont_fix"
      },
      {
        "code": "found",
        "name": "Cause found",
        "from": "investigation",
        "to": "fixing"
      },
      {
        "code": "not_a_bug",
        "name": "Not a bug",
        "from": "investigation",
        "to": "wont_fix"
      },
      {
        "code": "fixed",
        "name": "Fix ready",
        "from": "fixing",
        "to": "retesting"
      },
      {
        "code": "still_broken",
        "name": "Still broken",
        "from": "retesting",
        "to": "fixing"
      },
      {
        "code": "retested",
        "name": "Retest passed",
        "from": "retesting",
        "to": "verification"
      },
      {
        "code": "reopen",
        "name": "Not verified",
        "from": "verification",
        "to": "fixing"
      },
      {
        "code": "verified",
        "name": "Verified and closed",
        "from": "verification",
        "to": "closed"
      }
    ],
    "teams": {
      "retesting": "QA"
    },
    "home": "Development"
  },
  {
    "code": "dev-change-request",
    "name": "Change request",
    "discipline": "software",
    "summary": "A client change: assess, get approval, build, test.",
    "stages": [
      {
        "code": "requested",
        "name": "Requested",
        "stage_type": "start",
        "status_category": "open"
      },
      {
        "code": "impact",
        "name": "Impact analysis",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "approval",
        "name": "Approval",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "implementing",
        "name": "Implementation",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "testing",
        "name": "Testing",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "completed",
        "name": "Completed",
        "stage_type": "end",
        "status_category": "done"
      },
      {
        "code": "rejected",
        "name": "Rejected",
        "stage_type": "end",
        "status_category": "cancelled"
      }
    ],
    "steps": [
      {
        "code": "start",
        "name": "Start analysis",
        "from": "requested",
        "to": "impact"
      },
      {
        "code": "to_approval",
        "name": "Impact assessed",
        "from": "impact",
        "to": "approval"
      },
      {
        "code": "reject",
        "name": "Reject",
        "from": "approval",
        "to": "rejected"
      },
      {
        "code": "rethink",
        "name": "Needs more analysis",
        "from": "approval",
        "to": "impact"
      },
      {
        "code": "approve",
        "name": "Approve",
        "from": "approval",
        "to": "implementing"
      },
      {
        "code": "to_test",
        "name": "Built",
        "from": "implementing",
        "to": "testing"
      },
      {
        "code": "failed",
        "name": "Failed testing",
        "from": "testing",
        "to": "implementing"
      },
      {
        "code": "done",
        "name": "Tested",
        "from": "testing",
        "to": "completed"
      }
    ],
    "teams": {
      "testing": "QA"
    },
    "home": "Development"
  },
  {
    "code": "dev-deployment",
    "name": "Deployment",
    "discipline": "software",
    "summary": "Planned, checked, deployed and verified; or rolled back.",
    "stages": [
      {
        "code": "planned",
        "name": "Planned",
        "stage_type": "start",
        "status_category": "open"
      },
      {
        "code": "pre_checks",
        "name": "Pre-checks",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "deploying",
        "name": "Deploying",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "verifying",
        "name": "Verification",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "completed",
        "name": "Completed",
        "stage_type": "end",
        "status_category": "done"
      },
      {
        "code": "rolled_back",
        "name": "Rolled back",
        "stage_type": "end",
        "status_category": "cancelled"
      }
    ],
    "steps": [
      {
        "code": "start",
        "name": "Start checks",
        "from": "planned",
        "to": "pre_checks"
      },
      {
        "code": "go",
        "name": "Checks passed",
        "from": "pre_checks",
        "to": "deploying"
      },
      {
        "code": "deployed",
        "name": "Deployed",
        "from": "deploying",
        "to": "verifying"
      },
      {
        "code": "roll_back",
        "name": "Roll back",
        "from": "verifying",
        "to": "rolled_back"
      },
      {
        "code": "verified",
        "name": "Verified",
        "from": "verifying",
        "to": "completed"
      }
    ],
    "home": "Development"
  },
  {
    "code": "qa-testing",
    "name": "QA testing",
    "discipline": "software",
    "summary": "Test preparation, testing, defects to Development, retest and QA verification.",
    "stages": [
      {
        "code": "assigned",
        "name": "Testing assigned",
        "stage_type": "start",
        "status_category": "open"
      },
      {
        "code": "preparation",
        "name": "Test preparation",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "testing",
        "name": "Testing",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "defects",
        "name": "Defect reporting",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "dev_fix",
        "name": "Development fix",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "retesting",
        "name": "Retesting",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "verification",
        "name": "QA verification",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "completed",
        "name": "Completed",
        "stage_type": "end",
        "status_category": "done"
      },
      {
        "code": "dropped",
        "name": "Dropped",
        "stage_type": "end",
        "status_category": "cancelled"
      }
    ],
    "steps": [
      {
        "code": "start",
        "name": "Start preparation",
        "from": "assigned",
        "to": "preparation"
      },
      {
        "code": "drop",
        "name": "Drop",
        "from": "assigned",
        "to": "dropped"
      },
      {
        "code": "to_test",
        "name": "Ready to test",
        "from": "preparation",
        "to": "testing"
      },
      {
        "code": "found_defects",
        "name": "Defects found",
        "from": "testing",
        "to": "defects"
      },
      {
        "code": "all_passed",
        "name": "Everything passed",
        "from": "testing",
        "to": "verification"
      },
      {
        "code": "to_dev",
        "name": "Sent to Development",
        "from": "defects",
        "to": "dev_fix"
      },
      {
        "code": "fixed",
        "name": "Fixed",
        "from": "dev_fix",
        "to": "retesting"
      },
      {
        "code": "still_broken",
        "name": "Still broken",
        "from": "retesting",
        "to": "defects"
      },
      {
        "code": "retested",
        "name": "Retest passed",
        "from": "retesting",
        "to": "verification"
      },
      {
        "code": "reopen",
        "name": "Not verified",
        "from": "verification",
        "to": "testing"
      },
      {
        "code": "verified",
        "name": "Verified",
        "from": "verification",
        "to": "completed"
      }
    ],
    "teams": {
      "dev_fix": "Development"
    },
    "home": "QA"
  },
  {
    "code": "hr-recruitment",
    "name": "Recruitment",
    "discipline": "operations",
    "summary": "Requisition, approval, posting, screening, interview, selection, offer and joining.",
    "stages": [
      {
        "code": "requisition",
        "name": "Requisition",
        "stage_type": "start",
        "status_category": "open"
      },
      {
        "code": "approval",
        "name": "Approval",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "posting",
        "name": "Job posting",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "screening",
        "name": "Screening",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "interview",
        "name": "Interview",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "selection",
        "name": "Selection",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "offer",
        "name": "Offer",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "joined",
        "name": "Joined",
        "stage_type": "end",
        "status_category": "done"
      },
      {
        "code": "closed",
        "name": "Closed without hiring",
        "stage_type": "end",
        "status_category": "cancelled"
      }
    ],
    "steps": [
      {
        "code": "submit",
        "name": "Send for approval",
        "from": "requisition",
        "to": "approval"
      },
      {
        "code": "rejected",
        "name": "Not approved",
        "from": "approval",
        "to": "closed"
      },
      {
        "code": "approved",
        "name": "Approved",
        "from": "approval",
        "to": "posting"
      },
      {
        "code": "to_screen",
        "name": "Job posted",
        "from": "posting",
        "to": "screening"
      },
      {
        "code": "to_interview",
        "name": "Shortlisted",
        "from": "screening",
        "to": "interview"
      },
      {
        "code": "to_select",
        "name": "Interviews done",
        "from": "interview",
        "to": "selection"
      },
      {
        "code": "more_interviews",
        "name": "Needs more interviews",
        "from": "selection",
        "to": "interview"
      },
      {
        "code": "to_offer",
        "name": "Selected",
        "from": "selection",
        "to": "offer"
      },
      {
        "code": "declined",
        "name": "Offer declined",
        "from": "offer",
        "to": "screening"
      },
      {
        "code": "join",
        "name": "Joined",
        "from": "offer",
        "to": "joined"
      },
      {
        "code": "close",
        "name": "Close without hiring",
        "from": "posting",
        "to": "closed"
      }
    ],
    "home": "HR"
  },
  {
    "code": "hr-onboarding",
    "name": "Onboarding",
    "discipline": "operations",
    "summary": "Documents, verification, employee record, asset and access requests, induction.",
    "stages": [
      {
        "code": "documents",
        "name": "Document collection",
        "stage_type": "start",
        "status_category": "open"
      },
      {
        "code": "verification",
        "name": "Verification",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "employee",
        "name": "Employee creation",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "assets",
        "name": "Asset request",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "access",
        "name": "Access provisioning",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "induction",
        "name": "Induction",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "completed",
        "name": "Completed",
        "stage_type": "end",
        "status_category": "done"
      },
      {
        "code": "dropped",
        "name": "Not joining",
        "stage_type": "end",
        "status_category": "cancelled"
      }
    ],
    "steps": [
      {
        "code": "collected",
        "name": "Documents collected",
        "from": "documents",
        "to": "verification"
      },
      {
        "code": "drop",
        "name": "Not joining",
        "from": "documents",
        "to": "dropped"
      },
      {
        "code": "missing",
        "name": "Documents missing",
        "from": "verification",
        "to": "documents"
      },
      {
        "code": "verified",
        "name": "Verified",
        "from": "verification",
        "to": "employee"
      },
      {
        "code": "to_assets",
        "name": "Employee created",
        "from": "employee",
        "to": "assets"
      },
      {
        "code": "to_access",
        "name": "Assets requested",
        "from": "assets",
        "to": "access"
      },
      {
        "code": "to_induction",
        "name": "Access given",
        "from": "access",
        "to": "induction"
      },
      {
        "code": "complete",
        "name": "Induction done",
        "from": "induction",
        "to": "completed"
      }
    ],
    "teams": {
      "assets": "IT",
      "access": "IT"
    },
    "home": "HR"
  },
  {
    "code": "finance-invoice",
    "name": "Client invoice",
    "discipline": "operations",
    "summary": "Billing requirement, preparation, verification and approval before the invoice is issued.",
    "stages": [
      {
        "code": "requirement",
        "name": "Billing requirement",
        "stage_type": "start",
        "status_category": "open"
      },
      {
        "code": "preparing",
        "name": "Invoice preparation",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "verification",
        "name": "Verification",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "approval",
        "name": "Approval",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "issued",
        "name": "Invoice issued",
        "stage_type": "end",
        "status_category": "done"
      },
      {
        "code": "dropped",
        "name": "Dropped",
        "stage_type": "end",
        "status_category": "cancelled"
      }
    ],
    "steps": [
      {
        "code": "start",
        "name": "Start",
        "from": "requirement",
        "to": "preparing"
      },
      {
        "code": "drop",
        "name": "Drop",
        "from": "requirement",
        "to": "dropped"
      },
      {
        "code": "hand_in",
        "name": "Ready to verify",
        "from": "preparing",
        "to": "verification"
      },
      {
        "code": "send_back",
        "name": "Send back",
        "from": "verification",
        "to": "preparing"
      },
      {
        "code": "verified",
        "name": "Verified",
        "from": "verification",
        "to": "approval"
      },
      {
        "code": "changes",
        "name": "Needs changes",
        "from": "approval",
        "to": "preparing"
      },
      {
        "code": "issue",
        "name": "Approve and issue",
        "from": "approval",
        "to": "issued"
      }
    ],
    "teams": {
      "approval": "Finance"
    },
    "home": "Finance"
  },
  {
    "code": "finance-collection",
    "name": "Payment collection",
    "discipline": "operations",
    "summary": "Payment due, follow-up, received, verified and reconciled.",
    "stages": [
      {
        "code": "due",
        "name": "Payment due",
        "stage_type": "start",
        "status_category": "open"
      },
      {
        "code": "follow_up",
        "name": "Follow-up",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "received",
        "name": "Payment received",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "verification",
        "name": "Verification",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "reconciliation",
        "name": "Reconciliation",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "reconciled",
        "name": "Reconciled",
        "stage_type": "end",
        "status_category": "done"
      },
      {
        "code": "written_off",
        "name": "Written off",
        "stage_type": "end",
        "status_category": "cancelled"
      }
    ],
    "steps": [
      {
        "code": "start",
        "name": "Start follow-up",
        "from": "due",
        "to": "follow_up"
      },
      {
        "code": "got_paid",
        "name": "Payment received",
        "from": "follow_up",
        "to": "received"
      },
      {
        "code": "write_off",
        "name": "Write off",
        "from": "follow_up",
        "to": "written_off"
      },
      {
        "code": "to_verify",
        "name": "Ready to verify",
        "from": "received",
        "to": "verification"
      },
      {
        "code": "mismatch",
        "name": "Does not match",
        "from": "verification",
        "to": "received"
      },
      {
        "code": "verified",
        "name": "Verified",
        "from": "verification",
        "to": "reconciliation"
      },
      {
        "code": "reconcile",
        "name": "Reconciled",
        "from": "reconciliation",
        "to": "reconciled"
      }
    ],
    "home": "Finance"
  },
  {
    "code": "admin-request",
    "name": "Administration request",
    "discipline": "operations",
    "summary": "Procurement, maintenance or an internal request: assign, process, approve, do, verify.",
    "stages": [
      {
        "code": "requirement",
        "name": "Requirement",
        "stage_type": "start",
        "status_category": "open"
      },
      {
        "code": "assignment",
        "name": "Assignment",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "processing",
        "name": "Processing",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "approval",
        "name": "Approval",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "execution",
        "name": "Execution",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "verification",
        "name": "Verification",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "completed",
        "name": "Completed",
        "stage_type": "end",
        "status_category": "done"
      },
      {
        "code": "dropped",
        "name": "Dropped",
        "stage_type": "end",
        "status_category": "cancelled"
      }
    ],
    "steps": [
      {
        "code": "start",
        "name": "Assign",
        "from": "requirement",
        "to": "assignment"
      },
      {
        "code": "drop",
        "name": "Drop",
        "from": "requirement",
        "to": "dropped"
      },
      {
        "code": "to_process",
        "name": "Start processing",
        "from": "assignment",
        "to": "processing"
      },
      {
        "code": "needs_approval",
        "name": "Needs approval",
        "from": "processing",
        "to": "approval"
      },
      {
        "code": "no_approval",
        "name": "No approval needed",
        "from": "processing",
        "to": "execution"
      },
      {
        "code": "changes",
        "name": "Needs changes",
        "from": "approval",
        "to": "processing"
      },
      {
        "code": "approved",
        "name": "Approved",
        "from": "approval",
        "to": "execution"
      },
      {
        "code": "to_verify",
        "name": "Done",
        "from": "execution",
        "to": "verification"
      },
      {
        "code": "not_ok",
        "name": "Not as asked",
        "from": "verification",
        "to": "execution"
      },
      {
        "code": "verified",
        "name": "Verified",
        "from": "verification",
        "to": "completed"
      }
    ],
    "home": "Administration"
  },
  {
    "code": "support-case",
    "name": "Support case",
    "discipline": "operations",
    "summary": "Request received, classified, assigned, investigated, resolved and verified before closing.",
    "stages": [
      {
        "code": "received",
        "name": "Request received",
        "stage_type": "start",
        "status_category": "open"
      },
      {
        "code": "classification",
        "name": "Classification",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "assignment",
        "name": "Assignment",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "investigation",
        "name": "Investigation",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "resolution",
        "name": "Resolution",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "verification",
        "name": "Verification",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "closed",
        "name": "Closed",
        "stage_type": "end",
        "status_category": "done"
      },
      {
        "code": "rejected",
        "name": "Closed without action",
        "stage_type": "end",
        "status_category": "cancelled"
      }
    ],
    "steps": [
      {
        "code": "classify",
        "name": "Classify",
        "from": "received",
        "to": "classification"
      },
      {
        "code": "reject",
        "name": "Close without action",
        "from": "received",
        "to": "rejected"
      },
      {
        "code": "assign",
        "name": "Assign",
        "from": "classification",
        "to": "assignment"
      },
      {
        "code": "investigate",
        "name": "Start investigating",
        "from": "assignment",
        "to": "investigation"
      },
      {
        "code": "resolve",
        "name": "Resolution ready",
        "from": "investigation",
        "to": "resolution"
      },
      {
        "code": "to_verify",
        "name": "Ready to verify",
        "from": "resolution",
        "to": "verification"
      },
      {
        "code": "not_fixed",
        "name": "Not fixed",
        "from": "verification",
        "to": "investigation"
      },
      {
        "code": "close",
        "name": "Verified and closed",
        "from": "verification",
        "to": "closed"
      }
    ],
    "teams": {
      "investigation": "Development"
    },
    "home": "Support"
  },
  {
    "code": "it-asset",
    "name": "Asset lifecycle",
    "discipline": "operations",
    "summary": "Requirement, approval, procurement, registration, assignment and monitoring until return or retirement.",
    "stages": [
      {
        "code": "requirement",
        "name": "Requirement",
        "stage_type": "start",
        "status_category": "open"
      },
      {
        "code": "approval",
        "name": "Approval",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "procurement",
        "name": "Procurement",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "registration",
        "name": "Registration",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "assignment",
        "name": "Assignment",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "monitoring",
        "name": "Monitoring",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "closed",
        "name": "Retired or returned",
        "stage_type": "end",
        "status_category": "done"
      },
      {
        "code": "dropped",
        "name": "Dropped",
        "stage_type": "end",
        "status_category": "cancelled"
      }
    ],
    "steps": [
      {
        "code": "submit",
        "name": "Send for approval",
        "from": "requirement",
        "to": "approval"
      },
      {
        "code": "reject",
        "name": "Not approved",
        "from": "approval",
        "to": "dropped"
      },
      {
        "code": "approved",
        "name": "Approved",
        "from": "approval",
        "to": "procurement"
      },
      {
        "code": "received",
        "name": "Received",
        "from": "procurement",
        "to": "registration"
      },
      {
        "code": "registered",
        "name": "Registered",
        "from": "registration",
        "to": "assignment"
      },
      {
        "code": "assigned",
        "name": "Assigned",
        "from": "assignment",
        "to": "monitoring"
      },
      {
        "code": "reassign",
        "name": "Returned for reassignment",
        "from": "monitoring",
        "to": "assignment"
      },
      {
        "code": "retire",
        "name": "Retire or return",
        "from": "monitoring",
        "to": "closed"
      }
    ],
    "home": "IT"
  },
  {
    "code": "subscription-renewal",
    "name": "Subscription renewal",
    "discipline": "operations",
    "summary": "Domain, hosting, licence or API renewal: review, approve, renew and record.",
    "stages": [
      {
        "code": "due",
        "name": "Renewal due",
        "stage_type": "start",
        "status_category": "open"
      },
      {
        "code": "review",
        "name": "Still needed?",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "approval",
        "name": "Approval",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "renewing",
        "name": "Renewing",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "recorded",
        "name": "Recording",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "renewed",
        "name": "Renewed",
        "stage_type": "end",
        "status_category": "done"
      },
      {
        "code": "cancelled",
        "name": "Not renewed",
        "stage_type": "end",
        "status_category": "cancelled"
      }
    ],
    "steps": [
      {
        "code": "start",
        "name": "Start review",
        "from": "due",
        "to": "review"
      },
      {
        "code": "stop",
        "name": "No longer needed",
        "from": "review",
        "to": "cancelled"
      },
      {
        "code": "to_approval",
        "name": "Still needed",
        "from": "review",
        "to": "approval"
      },
      {
        "code": "declined",
        "name": "Not approved",
        "from": "approval",
        "to": "cancelled"
      },
      {
        "code": "approved",
        "name": "Approved",
        "from": "approval",
        "to": "renewing"
      },
      {
        "code": "renewed",
        "name": "Renewed",
        "from": "renewing",
        "to": "recorded"
      },
      {
        "code": "recorded",
        "name": "Recorded",
        "from": "recorded",
        "to": "renewed"
      }
    ],
    "home": "IT"
  },
  {
    "code": "mgmt-review",
    "name": "Management objective",
    "discipline": "general",
    "summary": "Objective, plan, targets, execution, performance review, decision, corrective action and follow-up.",
    "stages": [
      {
        "code": "objective",
        "name": "Objective",
        "stage_type": "start",
        "status_category": "open"
      },
      {
        "code": "planning",
        "name": "Planning",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "targets",
        "name": "Target allocation",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "execution",
        "name": "Execution",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "review",
        "name": "Performance review",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "decision",
        "name": "Decision",
        "stage_type": "normal",
        "status_category": "in_review"
      },
      {
        "code": "corrective",
        "name": "Corrective action",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "follow_up",
        "name": "Follow-up",
        "stage_type": "normal",
        "status_category": "in_progress"
      },
      {
        "code": "closed",
        "name": "Closed",
        "stage_type": "end",
        "status_category": "done"
      },
      {
        "code": "dropped",
        "name": "Dropped",
        "stage_type": "end",
        "status_category": "cancelled"
      }
    ],
    "steps": [
      {
        "code": "start",
        "name": "Start planning",
        "from": "objective",
        "to": "planning"
      },
      {
        "code": "drop",
        "name": "Drop",
        "from": "objective",
        "to": "dropped"
      },
      {
        "code": "to_targets",
        "name": "Plan ready",
        "from": "planning",
        "to": "targets"
      },
      {
        "code": "to_execute",
        "name": "Targets given",
        "from": "targets",
        "to": "execution"
      },
      {
        "code": "to_review",
        "name": "Ready for review",
        "from": "execution",
        "to": "review"
      },
      {
        "code": "more_work",
        "name": "Needs more work",
        "from": "review",
        "to": "execution"
      },
      {
        "code": "to_decide",
        "name": "Reviewed",
        "from": "review",
        "to": "decision"
      },
      {
        "code": "no_action",
        "name": "No action needed",
        "from": "decision",
        "to": "closed"
      },
      {
        "code": "act",
        "name": "Corrective action needed",
        "from": "decision",
        "to": "corrective"
      },
      {
        "code": "to_follow",
        "name": "Action taken",
        "from": "corrective",
        "to": "follow_up"
      },
      {
        "code": "recheck",
        "name": "Not resolved",
        "from": "follow_up",
        "to": "review"
      },
      {
        "code": "close",
        "name": "Close",
        "from": "follow_up",
        "to": "closed"
      }
    ],
    "home": "Management"
  }
]
