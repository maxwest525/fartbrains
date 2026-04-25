/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Idea Haven'

interface ReminderProps {
  subject?: string
  body?: string
}

const ReminderEmail = ({ subject, body }: ReminderProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{subject ?? 'Your reminder from ' + SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{subject ?? 'Reminder'}</Heading>
        <Section>
          <Text style={text}>
            {body ?? 'This is your scheduled reminder.'}
          </Text>
        </Section>
        <Text style={footer}>— {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ReminderEmail,
  subject: (data: Record<string, any>) =>
    (data?.subject as string) ?? 'Your reminder',
  displayName: 'Reminder',
  previewData: {
    subject: 'Reminder: Polish landing page copy',
    body: 'This is your reminder for "Polish landing page copy".',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily: 'Arial, sans-serif',
}

const container = {
  padding: '20px 25px',
  maxWidth: '560px',
}

const h1 = {
  fontSize: '22px',
  fontWeight: 'bold',
  color: '#000000',
  margin: '0 0 20px',
}

const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.5',
  margin: '0 0 25px',
}

const footer = {
  fontSize: '12px',
  color: '#999999',
  margin: '30px 0 0',
}
