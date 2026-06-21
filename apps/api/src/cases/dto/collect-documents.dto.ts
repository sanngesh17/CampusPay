import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class CollectDocumentsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  documents: string[];
}
