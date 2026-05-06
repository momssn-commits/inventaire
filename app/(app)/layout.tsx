import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const company = await prisma.company.findUnique({ where: { id: session.companyId } });

  return (
    <div className="flex min-h-screen">
      <Sidebar companyName={company?.name ?? '—'} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header user={{ name: session.name, email: session.email, role: session.role }} />
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1600px] w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
