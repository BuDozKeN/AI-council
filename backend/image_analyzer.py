"""Image analysis using vision-capable models."""

import base64
import httpx
import asyncio
import random
from typing import List, Dict, Any, Optional
from .config import OPENROUTER_API_KEY, OPENROUTER_API_URL
from . import openrouter  # Import to check MOCK_LLM at runtime

# Vision-capable model for image analysis
VISION_MODEL = "openai/gpt-4o"  # GPT-4o has excellent vision capabilities

# Mock mode delay range (seconds)
MOCK_DELAY_MIN = 0.3
MOCK_DELAY_MAX = 0.8

# Mock image descriptions for testing
MOCK_IMAGE_DESCRIPTIONS = [
    """**Image Analysis (Mock Mode)**

This appears to be a screenshot of a software application interface.

**Main Elements:**
- A header bar with navigation menu items
- A sidebar containing a list of options/items
- A main content area showing text and form elements
- Several buttons for user interaction

**Text Visible:**
- "Settings" label in the header
- Various menu items in the sidebar
- Form field labels and button text

**Notable Details:**
- Clean, modern UI design with a light color scheme
- Responsive layout suggesting desktop application
- Standard web application patterns visible

*This is a mock description generated for testing purposes.*""",

    """**Image Analysis (Mock Mode)**

This image shows a data visualization or chart.

**Chart Type:** Bar chart / Line graph (representative)

**Data Points:**
| Category | Value |
|----------|-------|
| Item A   | 45%   |
| Item B   | 32%   |
| Item C   | 23%   |

**Key Observations:**
1. Clear trend visible in the data
2. Axis labels indicate time-series data
3. Legend shows multiple data series
4. Color coding used for different categories

**Context:**
The chart appears to be displaying business metrics or analytics data.

*This is a mock description generated for testing purposes.*""",

    """**Image Analysis (Mock Mode)**

This image contains a document or text-heavy content.

**Document Structure:**
- Title/heading at the top
- Multiple paragraphs of body text
- Bulleted or numbered list sections
- Possibly some highlighted or emphasized text

**Visible Text (representative):**
> "Lorem ipsum dolor sit amet, consectetur adipiscing elit.
> Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."

**Format:**
- Standard document layout
- Clear typography and spacing
- Professional formatting

**Purpose:**
Appears to be informational/instructional content.

*This is a mock description generated for testing purposes.*""",
]


async def _mock_analyze_image(image_name: str) -> str:
    """Generate a mock image analysis for testing."""
    await asyncio.sleep(random.uniform(MOCK_DELAY_MIN, MOCK_DELAY_MAX))
    print(f"[MOCK IMAGE ANALYSIS] Analyzing: {image_name}", flush=True)
    return random.choice(MOCK_IMAGE_DESCRIPTIONS)


# Analysis prompt for describing images
IMAGE_ANALYSIS_PROMPT = """Analyze this image in detail. Describe:
1. What the image shows (main subject, context, setting)
2. Any text visible in the image (transcribe exactly if present)
3. Key details relevant for understanding the image
4. Any data, charts, diagrams, or structured information

Be thorough but concise. This description will be used by other AI models that cannot see the image directly.
"""


async def analyze_image(
    image_data: bytes,
    image_type: str = "image/png",
    custom_prompt: Optional[str] = None,
    image_name: str = "image",
) -> Optional[str]:
    """
    Analyze a single image using a vision-capable model.

    Args:
        image_data: Raw image bytes
        image_type: MIME type of the image
        custom_prompt: Optional custom analysis prompt
        image_name: Name of the image (for mock mode logging)

    Returns:
        Text description of the image, or None if analysis failed
    """
    # Check for mock mode - return mock description without hitting API
    if openrouter.MOCK_LLM:
        return await _mock_analyze_image(image_name)

    # Convert image to base64
    base64_image = base64.b64encode(image_data).decode('utf-8')

    # Build the message with image
    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": custom_prompt or IMAGE_ANALYSIS_PROMPT
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{image_type};base64,{base64_image}"
                    }
                }
            ]
        }
    ]

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": VISION_MODEL,
        "messages": messages,
        "max_tokens": 2048,
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                OPENROUTER_API_URL,
                headers=headers,
                json=payload
            )
            response.raise_for_status()

            data = response.json()
            content = data['choices'][0]['message'].get('content', '')
            return content

    except Exception as e:
        print(f"[IMAGE ANALYSIS ERROR] {type(e).__name__}: {e}", flush=True)
        return None


async def analyze_images(
    images: List[Dict[str, Any]],
    user_query: str,
) -> str:
    """
    Analyze multiple images and create a combined context.

    Args:
        images: List of image dicts with 'data' (bytes), 'type' (MIME type), 'name' (filename)
        user_query: The user's question to provide context for analysis

    Returns:
        Combined text description of all images for the council
    """
    if not images:
        return ""

    descriptions = []

    for i, img in enumerate(images, 1):
        # Create a contextual prompt
        prompt = f"""The user is asking: "{user_query}"

Analyze this image (Image {i}) in detail. Focus on aspects relevant to the user's question.
Describe what you see, including any text, data, diagrams, or visual elements.
Be thorough so that other AI models can understand the image without seeing it."""

        description = await analyze_image(
            image_data=img['data'],
            image_type=img.get('type', 'image/png'),
            custom_prompt=prompt,
            image_name=img.get('name', f'image_{i}')
        )

        if description:
            descriptions.append(f"**[Image {i}: {img.get('name', 'Attached Image')}]**\n{description}")
        else:
            descriptions.append(f"**[Image {i}: {img.get('name', 'Attached Image')}]**\n(Unable to analyze this image)")

    # Combine all descriptions
    combined = "\n\n---\n\n".join(descriptions)

    return f"""
## Attached Images Analysis

The user has attached {len(images)} image(s). A vision-capable AI has analyzed them:

{combined}

---

Please consider these image descriptions when responding to the user's question.
"""


def format_query_with_images(
    original_query: str,
    image_analysis: str,
) -> str:
    """
    Format the user's query to include image analysis context.

    Args:
        original_query: The user's original question
        image_analysis: The combined image analysis text

    Returns:
        Enhanced query with image context
    """
    if not image_analysis:
        return original_query

    return f"""{original_query}

{image_analysis}"""
