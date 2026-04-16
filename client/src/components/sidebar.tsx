import React from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Search, Settings, Zap, Target, Globe, Rocket, BookOpen, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/",     label: "Dashboard", icon: LayoutDashboard, live: true },
  { href: "/seo",  label: "SEO",       icon: Globe,           live: true },
  { href: "/meta", label: "Meta",      icon: Target,          live: true },
  { href: "/ppc",  label: "PPC",       icon: Search,          live: true },
];

const COMING_SOON: { label: string; icon: React.ElementType }[] = [];

// Sibling apps in the Key Lime operating system. These are EXTERNAL Railway
// services — full redirect rather than in-app routing.
const SIBLING_APPS = [
  {
    href: "https://homedirect-hub-production-d9ad.up.railway.app/#/launch",
    label: "Launch Playbook",
    icon: Rocket,
    hint: "HomeDirect HQ · Tampa Bay launch tactics + owners",
  },
  {
    href: "https://icp-hub-production.up.railway.app",
    label: "Brand Hub",
    icon: BookOpen,
    hint: "icp-hub · philosophy, brand guide, messaging, ICPs",
  },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="w-64 shrink-0 flex flex-col border-r border-border bg-card h-screen">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          {/* SVG mark */}
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-label="HomeDirectAI Marketing Hub">
            <rect width="28" height="28" rx="6" fill="hsl(152,100%,39%)" fillOpacity="0.15"/>
            <path d="M14 5L4 12.5V23H10V17H18V23H24V12.5L14 5Z" stroke="hsl(152,100%,39%)" strokeWidth="1.75" strokeLinejoin="round"/>
            <circle cx="20" cy="8" r="3" fill="hsl(192,100%,50%)" fillOpacity="0.9"/>
          </svg>
          <div>
            <p className="text-xs font-bold text-foreground leading-none">Marketing Hub</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">HomeDirectAI</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        <p className="px-2 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Channels</p>
        {NAV.map(({ href, label, icon: Icon, live }) => {
          const active = location === href || (href !== "/" && location.startsWith(href));
          return (
            <Link key={href} href={href}>
              <a className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors group",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}>
                <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                <span className="flex-1 truncate">{label}</span>
                {!live && (
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Soon</span>
                )}
              </a>
            </Link>
          );
        })}

        {COMING_SOON.length > 0 && (
          <>
            <p className="px-2 pt-4 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Coming Next</p>
            {COMING_SOON.map(({ label, icon: Icon }) => (
              <div key={label} className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm text-muted-foreground/40 cursor-not-allowed select-none">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{label}</span>
                <Zap className="h-3 w-3 text-muted-foreground/30" />
              </div>
            ))}
          </>
        )}

        {/* Sibling apps — external links to the rest of the Key Lime stack */}
        <p className="px-2 pt-4 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Related Apps</p>
        {SIBLING_APPS.map(({ href, label, icon: Icon, hint }) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noreferrer"
            title={hint}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors group text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
            <span className="flex-1 truncate">{label}</span>
            <ExternalLink className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground" />
          </a>
        ))}
      </nav>

      {/* Settings */}
      <div className="px-2 py-3 border-t border-border">
        <Link href="/settings">
          <a className={cn(
            "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors",
            location === "/settings"
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          )}>
            <Settings className="h-4 w-4 shrink-0" />
            Settings
          </a>
        </Link>
      </div>
    </aside>
  );
}
