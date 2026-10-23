import { Link } from 'react-router-dom'
import { AlarmClockOff } from 'lucide-react'
import { Button, EmptyState } from '../components/ui'

export default function NotFound() {
  return (
    <div className="grid min-h-[70vh] place-items-center">
      <EmptyState icon={AlarmClockOff} title="Page not found" body="That page doesn't exist — maybe you're still dreaming?" action={<Link to="/"><Button>Back to Wakeful</Button></Link>} />
    </div>
  )
}
