import nodemailer from 'nodemailer';

export function createTransporter(email: string, password: string) {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: email,
      pass: password,
    },
  });
}

export function buildBody(template: string, name: string): string {
  return template.replace(/\{\{Name\}\}/gi, name || 'there');
}
