import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { FileText, ScanLine, Sparkles, ShieldCheck, BarChart3, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">L</div>
            <span className="font-display font-semibold text-lg">InvoiceVision</span>
          </Link>
          <nav className="flex items-center gap-3">
            <Link to="/auth"><Button variant="ghost">Sign in</Button></Link>
            <Link to="/auth" search={{ mode: "signup" }}><Button>Get started</Button></Link>
          </nav>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-20 md:py-28">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground mb-6">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            AI-powered invoice processing
          </div>
          <h1 className="text-5xl md:text-6xl font-display font-bold tracking-tight text-foreground">
            Turn every invoice into <span className="text-primary">clean data</span>, instantly.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
            Upload PDFs or photos of your invoices. InvoiceVision extracts every line, flags duplicates
            and anomalies, and gives your team a real-time view of what you're spending.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth" search={{ mode: "signup" }}>
              <Button size="lg" className="gap-2">Start free <ArrowRight className="w-4 h-4" /></Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline">I already have an account</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24 grid md:grid-cols-3 gap-6">
        {[
          { icon: ScanLine, title: "Instant extraction", body: "Vendor, dates, GST, totals, line items — captured from any invoice format." },
          { icon: ShieldCheck, title: "Duplicate & risk detection", body: "AI flags duplicate submissions and suspicious invoices before they get paid." },
          { icon: BarChart3, title: "Live analytics", body: "Monthly spend, top vendors, tax paid, paid vs pending — all in one dashboard." },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border bg-card p-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
              <Icon className="w-5 h-5" />
            </div>
            <h3 className="font-display font-semibold text-lg">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>

      <section className="border-t bg-card">
        <div className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-4 gap-8">
          {[
            ["Upload", "Drag a PDF, JPG or PNG. We store it securely."],
            ["Extract", "AI reads the invoice and structures every field."],
            ["Review", "Edit anything, get an AI summary and risk check."],
            ["Approve", "Route to a manager, mark paid, and export."],
          ].map(([title, body], i) => (
            <div key={title}>
              <div className="text-xs font-mono text-primary">STEP {i + 1}</div>
              <div className="font-display font-semibold mt-1">{title}</div>
              <div className="text-sm text-muted-foreground mt-1">{body}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span>InvoiceVision · Smart invoice processing</span>
          </div>
          <div>© {new Date().getFullYear()}</div>
        </div>
      </footer>
    </div>
  );
}
