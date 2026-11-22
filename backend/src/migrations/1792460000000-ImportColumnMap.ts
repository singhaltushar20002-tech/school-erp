import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `imports.column_map` and `imports.file_headers`: matching a file's
 * columns to the template by hand when its headers differ.
 */
export class ImportColumnMap1792460000000 implements MigrationInterface {
  name = 'ImportColumnMap1792460000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "imports" ADD "column_map" jsonb, ADD "file_headers" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "imports" DROP COLUMN "file_headers", DROP COLUMN "column_map"`,
    );
  }
}
