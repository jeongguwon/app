"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "홈" },
  { href: "/posts/new", label: "등록" },
  { href: "/me", label: "내 정보" },
  { href: "/admin/reports", label: "관리" },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur sm:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-4 px-2 py-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href} className="px-1">
              <Link
                href={item.href}
                className={`flex h-11 items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
                  active
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}