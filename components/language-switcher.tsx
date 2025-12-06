"use client";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import { Languages } from "lucide-react";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setLocale(locale === "en" ? "zh" : "en")}
      title={locale === "en" ? "Switch to Chinese" : "切换到英文"}
    >
      <Languages className="w-4 h-4" />
    </Button>
  );
}
