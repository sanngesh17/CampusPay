import { IsString } from 'class-validator';

export class IssueCredentialDto {
  @IsString()
  subject: string;

  @IsString()
  credentialType: string;
}
