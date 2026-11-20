import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `results.co_scholastic`: the class teacher's co-scholastic grades
 * (work education, art, health and physical education, discipline) that
 * the CBSE report card prints.
 */
export class ResultCoScholastic1792440000000 implements MigrationInterface {
  name = 'ResultCoScholastic1792440000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "results" ADD "co_scholastic" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "results" DROP COLUMN "co_scholastic"`,
    );
  }
}
