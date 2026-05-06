import { prisma } from './db';

export async function nextSequence(code: string, prefix: string, padding = 5): Promise<string> {
  return prisma.$transaction(async (tx) => {
    let seq = await tx.sequence.findUnique({ where: { code } });
    if (!seq) {
      seq = await tx.sequence.create({ data: { code, prefix, padding, next: 1 } });
    }
    const value = `${seq.prefix}${String(seq.next).padStart(seq.padding, '0')}`;
    await tx.sequence.update({ where: { code }, data: { next: seq.next + 1 } });
    return value;
  });
}
