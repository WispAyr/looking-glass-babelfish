# Looking Glass Design System

## Project Overview
Looking Glass is a comprehensive surveillance and automation platform. Babelfish serves as the API explorer and broker component.

## Brand Identity

### Color Palette

#### Primary Colors
- **Deep Space Blue**: `#1a1a2e` - Main background, headers
- **Electric Blue**: `#16213e` - Secondary background, cards
- **Neon Cyan**: `#0f3460` - Accent color, highlights
- **Bright Cyan**: `#00d4ff` - Primary action color, links
- **Cyber Green**: `#00ff88` - Success states, positive actions

#### Secondary Colors
- **Warning Orange**: `#ff6b35` - Warnings, alerts
- **Error Red**: `#ff4757` - Errors, destructive actions
- **Neutral Gray**: `#2d3436` - Borders, dividers
- **Light Gray**: `#636e72` - Secondary text
- **White**: `#ffffff` - Primary text, icons

#### Gradients
- **Primary Gradient**: `linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)`
- **Accent Gradient**: `linear-gradient(135deg, #00d4ff 0%, #00ff88 100%)`
- **Card Gradient**: `linear-gradient(135deg, #16213e 0%, #0f3460 100%)`

### Typography

#### Font Family
- **Primary**: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
- **Monospace**: 'JetBrains Mono', 'Fira Code', Consolas, monospace

#### Font Weights
- **Light**: 300
- **Regular**: 400
- **Medium**: 500
- **Semi-bold**: 600
- **Bold**: 700

#### Font Sizes
- **XS**: 0.75rem (12px)
- **SM**: 0.875rem (14px)
- **BASE**: 1rem (16px)
- **LG**: 1.125rem (18px)
- **XL**: 1.25rem (20px)
- **2XL**: 1.5rem (24px)
- **3XL**: 1.875rem (30px)
- **4XL**: 2.25rem (36px)

### Spacing System
- **XS**: 0.25rem (4px)
- **SM**: 0.5rem (8px)
- **MD**: 1rem (16px)
- **LG**: 1.5rem (24px)
- **XL**: 2rem (32px)
- **2XL**: 3rem (48px)
- **3XL**: 4rem (64px)

### Border Radius
- **SM**: 0.25rem (4px)
- **MD**: 0.5rem (8px)
- **LG**: 0.75rem (12px)
- **XL**: 1rem (16px)
- **Full**: 9999px

### Shadows
- **SM**: `0 1px 2px 0 rgba(0, 0, 0, 0.05)`
- **MD**: `0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)`
- **LG**: `0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)`
- **XL**: `0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)`
- **Glow**: `0 0 20px rgba(0, 212, 255, 0.3)`

## Component Patterns

### Cards
- Background: `#16213e`
- Border: `1px solid #2d3436`
- Border Radius: `0.75rem`
- Shadow: `0 4px 6px -1px rgba(0, 0, 0, 0.1)`
- Padding: `1.5rem`

### Buttons
- **Primary**: Background `#00d4ff`, text `#ffffff`, hover `#00b8e6`
- **Secondary**: Background `transparent`, border `1px solid #00d4ff`, text `#00d4ff`
- **Success**: Background `#00ff88`, text `#1a1a2e`
- **Warning**: Background `#ff6b35`, text `#ffffff`
- **Danger**: Background `#ff4757`, text `#ffffff`

### Input Fields
- Background: `#0f3460`
- Border: `1px solid #2d3436`
- Border Radius: `0.5rem`
- Focus Border: `2px solid #00d4ff`
- Text Color: `#ffffff`
- Placeholder: `#636e72`

### Navigation
- Background: `#1a1a2e`
- Active Item: `#00d4ff`
- Hover: `#16213e`
- Text: `#ffffff`

### Status Indicators
- **Online**: `#00ff88`
- **Offline**: `#ff4757`
- **Warning**: `#ff6b35`
- **Processing**: `#00d4ff`

## Layout Patterns

### Grid System
- **Container**: Max width `1200px`, centered
- **Columns**: 12-column grid system
- **Gutters**: `1rem` between columns
- **Breakpoints**:
  - Mobile: `< 768px`
  - Tablet: `768px - 1024px`
  - Desktop: `> 1024px`

### Sidebar
- Width: `280px` (collapsed: `60px`)
- Background: `#1a1a2e`
- Border: `1px solid #2d3436`

### Header
- Height: `64px`
- Background: `#16213e`
- Border Bottom: `1px solid #2d3436`

### Content Area
- Background: `#1a1a2e`
- Padding: `2rem`

## Animation Guidelines

### Transitions
- **Fast**: `150ms ease-in-out`
- **Normal**: `250ms ease-in-out`
- **Slow**: `350ms ease-in-out`

### Hover Effects
- Scale: `transform: scale(1.02)`
- Glow: `box-shadow: 0 0 20px rgba(0, 212, 255, 0.3)`

### Loading States
- Skeleton loading with subtle pulse animation
- Spinner: Rotating border with `#00d4ff` color

## Iconography

### Icon Style
- **Line Weight**: 2px
- **Color**: Inherit from parent
- **Size**: `1.25rem` (20px) default
- **Style**: Outlined, minimal, geometric

### Common Icons
- **Camera**: Video camera icon
- **Settings**: Gear icon
- **Dashboard**: Grid icon
- **Events**: Bell icon
- **API**: Code icon
- **MQTT**: Message icon
- **Connection**: Wifi icon

## Accessibility

### Color Contrast
- Minimum contrast ratio: 4.5:1
- High contrast mode support
- Color-blind friendly palette

### Focus States
- Visible focus indicators
- Keyboard navigation support
- Screen reader compatibility

### Motion
- Respect `prefers-reduced-motion`
- Smooth, purposeful animations
- No auto-playing content

## Implementation Notes

### CSS Variables
```css
:root {
  /* Colors */
  --color-primary: #00d4ff;
  --color-secondary: #00ff88;
  --color-background: #1a1a2e;
  --color-surface: #16213e;
  --color-accent: #0f3460;
  
  /* Typography */
  --font-family: 'Inter', sans-serif;
  --font-size-base: 1rem;
  
  /* Spacing */
  --spacing-base: 1rem;
  
  /* Shadows */
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
```

### Responsive Design
- Mobile-first approach
- Flexible layouts
- Touch-friendly interactions
- Optimized for various screen sizes

This design system ensures consistency across all Looking Glass applications while providing a modern, cyberpunk-inspired aesthetic that's both functional and visually appealing. 