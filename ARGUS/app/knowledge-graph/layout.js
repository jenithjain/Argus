"use client";

import { useState, useEffect } from "react";
import StaggeredMenu from "@/components/StaggeredMenu";

export default function KnowledgeGraphLayout({ children }) {
  const [menuBtnColor, setMenuBtnColor] = useState('#000000');

  useEffect(() => {
    const updateColor = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setMenuBtnColor(isDark ? '#ffffff' : '#000000');
    };
    
    updateColor();
    
    const observer = new MutationObserver(updateColor);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* StaggeredMenu - positioned in top-right corner only */}
      <div className="fixed inset-0 z-50 pointer-events-none">
        <div className="pointer-events-none w-full h-full">
          <style>{`
            .kg-menu .staggered-menu-header .sm-logo,
            .kg-menu .staggered-menu-header > div:first-child {
              display: none !important;
            }
            .kg-menu .staggered-menu-header {
              justify-content: flex-end !important;
              padding: 0.75rem 1rem !important;
            }
            .kg-menu .sm-toggle .sm-icon {
              order: -1;
            }
            .kg-menu .sm-toggle-textWrap {
              margin-right: 0 !important;
              margin-left: 0.5em;
            }
          `}</style>
          <StaggeredMenu
            position="right"
            isFixed={false}
            logoUrl=""
            accentColor="#22c55e"
            colors={["#0f172a", "#111827", "#1f2937"]}
            menuButtonColor={menuBtnColor}
            openMenuButtonColor="#22c55e"
            className="kg-menu"
            items={[
              { label: "Home", link: "/", ariaLabel: "Go to Home" },
              { label: "Dashboard", link: "/dashboard", ariaLabel: "View Dashboard" },
              { label: "Knowledge Graph", link: "/knowledge-graph", ariaLabel: "Threat Intelligence Graph" },
              { label: "Assistant", link: "/assistant", ariaLabel: "AI Assistant" },
              { label: "Profile", link: "/profile", ariaLabel: "View Profile" },
            ]}
          />
        </div>
      </div>

      <main>
        {children}
      </main>
    </>
  );
}
