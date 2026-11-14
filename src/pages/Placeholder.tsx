import { Clock } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'

interface PlaceholderProps {
  title: string
  phase: number
  description?: string
}

export function Placeholder({ title, phase, description }: PlaceholderProps) {
  const setSection = useAppStore((s) => s.setSection)
  return (
    <div className="flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center px-6 py-10 text-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Clock className="size-6" />
          </span>
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta sección llega en la fase {phase}.
          </p>
          {description ? (
            <p className="mt-3 text-sm text-muted-foreground">{description}</p>
          ) : null}
          <Button className="mt-6" onClick={() => setSection('inicio')}>
            Volver a Inicio
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
