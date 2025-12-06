"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { WalletConnect } from "@/components/wallet-connect";
import { useI18n } from "@/components/i18n-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

export function Header() {
  const { t } = useI18n();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="border-b border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <Image
                src="/logo.png"
                alt="Rainbow Bridge Vault"
                width={40}
                height={40}
                className="w-10 h-10"
              />
              <span className="font-bold text-lg bg-linear-to-r from-violet-500 via-fuchsia-500 to-orange-500 bg-clip-text text-transparent">
                {t("app.name")}
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              <Link href="/">
                <Button
                  variant={pathname === "/" ? "secondary" : "ghost"}
                  className="rounded-xl"
                >
                  {t("nav.home")}
                </Button>
              </Link>
              <Link href="/about">
                <Button
                  variant={pathname === "/about" ? "secondary" : "ghost"}
                  className="rounded-xl"
                >
                  {t("nav.about")}
                </Button>
              </Link>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="rounded-xl">
                    {t("nav.protocol")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-white dark:bg-slate-900">
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("nav.protocol")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("nav.protocolNotOpened")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogAction>{t("nav.protocolOk")}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {/* Desktop actions */}
            <div className="hidden md:flex items-center gap-2">
              <LanguageSwitcher />
              <ThemeSwitcher />
            </div>
            <div className="hidden md:block">
              <WalletConnect />
            </div>

            <div className="flex md:hidden items-center gap-1">
              <LanguageSwitcher />
              <ThemeSwitcher />
            </div>

            {/* Mobile menu button */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">{t("nav.menu")}</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-72 bg-white dark:bg-slate-900"
              >
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Image
                      src="/logo.png"
                      alt="Rainbow Bridge Vault"
                      width={32}
                      height={32}
                      className="w-8 h-8"
                    />
                    <span className="font-bold text-base bg-linear-to-r from-violet-500 via-fuchsia-500 to-orange-500 bg-clip-text text-transparent">
                      {t("app.name")}
                    </span>
                  </SheetTitle>
                </SheetHeader>

                <div className="flex justify-center mt-6">
                  <WalletConnect />
                </div>

                {/* Mobile Navigation Links */}
                <nav className="flex flex-col gap-2 mt-6">
                  <Link href="/" onClick={() => setMobileMenuOpen(false)}>
                    <Button
                      variant={pathname === "/" ? "secondary" : "ghost"}
                      className="w-full justify-start rounded-xl"
                    >
                      {t("nav.home")}
                    </Button>
                  </Link>
                  <Link href="/about" onClick={() => setMobileMenuOpen(false)}>
                    <Button
                      variant={pathname === "/about" ? "secondary" : "ghost"}
                      className="w-full justify-start rounded-xl"
                    >
                      {t("nav.about")}
                    </Button>
                  </Link>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-start rounded-xl"
                      >
                        {t("nav.protocol")}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-white dark:bg-slate-900">
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("nav.protocol")}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("nav.protocolNotOpened")}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogAction>
                          {t("nav.protocolOk")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
