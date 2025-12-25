import { Button } from '@/components/ui/button'
import { Languages } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { cn } from '@/lib/utils'

export function LanguageSelector({ className }: { className?: string }) {
    const { currentLanguage, setLanguage, availableLanguages } = useLanguage()

    const toggleLanguage = () => {
        const currentIndex = availableLanguages.indexOf(currentLanguage)
        const nextIndex = (currentIndex + 1) % availableLanguages.length
        setLanguage(availableLanguages[nextIndex])
    }

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={toggleLanguage}
            className={cn(
                "flex items-center gap-2 h-8 text-xs font-mono transition-all duration-300",
                "text-cyber-muted hover:text-white hover:bg-white/5",
                className
            )}
            title={currentLanguage === 'en' ? 'Switch to Traditional Chinese' : '切換至英文'}
        >
            <Languages className="w-4 h-4" />
            <span className="hidden sm:inline font-chinese">
                {currentLanguage === 'en' ? 'EN' : '繁中'}
            </span>
        </Button>
    )
}
