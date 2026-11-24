import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Plans are priced in Indian rupees: the column default becomes INR and
 * the seeded plans move from BDT to INR. The amounts stay as they were
 * (minor units), so Basic is ₹15, Standard ₹25 and Premium ₹40 per
 * student a month.
 */
export class PlansInRupees1792480000000 implements MigrationInterface {
  name = 'PlansInRupees1792480000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plans" ALTER COLUMN "currency" SET DEFAULT 'INR'`,
    );
    await queryRunner.query(
      `UPDATE "plans" SET "currency" = 'INR' WHERE "currency" = 'BDT'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "plans" SET "currency" = 'BDT' WHERE "currency" = 'INR'`,
    );
    await queryRunner.query(
      `ALTER TABLE "plans" ALTER COLUMN "currency" SET DEFAULT 'BDT'`,
    );
  }
}
