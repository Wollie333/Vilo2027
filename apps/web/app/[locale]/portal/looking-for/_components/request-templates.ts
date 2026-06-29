/**
 * Request Templates - Pre-defined presets for common Looking For requests
 * These help guests quickly fill out common request types
 */

export interface RequestTemplate {
  id: string;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  defaults: {
    category: "accommodation" | "experience" | "venue" | "event" | "other";
    title?: string;
    description?: string;
    adults?: number;
    children?: number;
    infants?: number;
    is_urgent?: boolean;
  };
}

export const REQUEST_TEMPLATES: RequestTemplate[] = [
  {
    id: "weekend-getaway",
    name: "Weekend Getaway",
    description: "Quick escape for 2-3 nights",
    icon: "Palmtree",
    defaults: {
      category: "accommodation",
      title: "Weekend getaway for ",
      adults: 2,
      children: 0,
      infants: 0,
      is_urgent: false,
    },
  },
  {
    id: "family-vacation",
    name: "Family Vacation",
    description: "Trip with kids",
    icon: "Users",
    defaults: {
      category: "accommodation",
      title: "Family vacation in ",
      adults: 2,
      children: 2,
      infants: 0,
      is_urgent: false,
    },
  },
  {
    id: "romantic-escape",
    name: "Romantic Escape",
    description: "Couples retreat",
    icon: "Heart",
    defaults: {
      category: "accommodation",
      title: "Romantic getaway for 2 in ",
      adults: 2,
      children: 0,
      infants: 0,
      is_urgent: false,
    },
  },
  {
    id: "business-trip",
    name: "Business Trip",
    description: "Work travel accommodation",
    icon: "Briefcase",
    defaults: {
      category: "accommodation",
      title: "Business accommodation in ",
      adults: 1,
      children: 0,
      infants: 0,
      is_urgent: true,
    },
  },
  {
    id: "group-celebration",
    name: "Group Celebration",
    description: "Birthday, bachelor/ette, reunion",
    icon: "PartyPopper",
    defaults: {
      category: "venue",
      title: "Venue for group celebration in ",
      adults: 10,
      children: 0,
      infants: 0,
      is_urgent: false,
    },
  },
  {
    id: "wine-tasting",
    name: "Wine Experience",
    description: "Wine farm tours & tastings",
    icon: "Wine",
    defaults: {
      category: "experience",
      title: "Wine tasting experience in ",
      adults: 4,
      children: 0,
      infants: 0,
      is_urgent: false,
    },
  },
  {
    id: "adventure-trip",
    name: "Adventure Trip",
    description: "Outdoor activities & thrills",
    icon: "Mountain",
    defaults: {
      category: "experience",
      title: "Adventure activities in ",
      adults: 2,
      children: 0,
      infants: 0,
      is_urgent: false,
    },
  },
  {
    id: "corporate-event",
    name: "Corporate Event",
    description: "Team building, conference, workshop",
    icon: "Building2",
    defaults: {
      category: "event",
      title: "Corporate event venue in ",
      adults: 20,
      children: 0,
      infants: 0,
      is_urgent: false,
    },
  },
];

export function getTemplateById(id: string): RequestTemplate | undefined {
  return REQUEST_TEMPLATES.find((t) => t.id === id);
}
