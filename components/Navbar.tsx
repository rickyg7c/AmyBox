'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Package, Plus, Upload } from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();

  const links = [
    { href: '/', icon: Package, label: 'Boxes' },
    { href: '/add', icon: Plus, label: 'Add Box' },
    { href: '/bulk', icon: Upload, label: 'Bulk Import' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 md:top-0 md:bottom-auto md:border-t-0 md:border-b">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-around md:justify-start md:space-x-8 h-16">
          {links.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col md:flex-row items-center justify-center md:space-x-2 px-3 py-2 transition-colors ${
                  isActive ? 'text-indigo-600' : 'text-gray-500 hover:text-indigo-500'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs md:text-sm font-medium mt-1 md:mt-0">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
