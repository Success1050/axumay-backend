import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const plans = [
    {
      name: 'Basic Plan',
      interestRate: 5.0,
      minDeposit: 100,
      maxDeposit: 999,
      maturityHours: 24, // 24 hours per payout
      capitalReturn: true,
    },
    {
      name: 'Premium Plan',
      interestRate: 10.0,
      minDeposit: 1000,
      maxDeposit: 4999,
      maturityHours: 24,
      capitalReturn: true,
    },
    {
      name: 'VIP Plan',
      interestRate: 25.0,
      minDeposit: 5000,
      maxDeposit: 999999,
      maturityHours: 24,
      capitalReturn: true,
    }
  ];

  for (const plan of plans) {
    await prisma.investmentPlan.create({ data: plan });
    console.log(`Created ${plan.name}`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
