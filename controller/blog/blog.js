// npm install uuid

// Sample blogs with unique IDs
const blogs = [
  {
    id: 1,
    title: "The Art of Deep Tissue Massage: London's Premier Wellness Experience",
    category: "Massage",
    author: "Dr. Sarah Chen",
    date: "15 January 2024",
    reading_time: "8 min read",
    banner_image: "https://images.unsplash.com/photo-1605040056130-38d9faad3534?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    content: [
      {
        section: "Introduction",
        text: "In the bustling heart of London, where the pace of life never seems to slow, finding moments of true tranquility becomes not just a luxury, but a necessity. At Noira, we understand that deep tissue massage is more than just a treatment—it’s an art form that requires skill, intuition, and a deep understanding of the human body."
      },
      {
        section: "The Science Behind Deep Tissue Therapy",
        text: "Deep tissue massage works by applying sustained pressure using slow, deep strokes to target the inner layers of your muscles and connective tissues."
      },
      {
        section: "Benefits You Can Expect",
        list: [
          "Reduced chronic pain and muscle tension",
          "Improved blood pressure and circulation",
          "Enhanced flexibility and range of motion",
          "Stress relief and mental clarity",
          "Better sleep quality"
        ]
      }
    ],
    cta: {
      headline: "Ready to Experience Luxury Wellness?",
      button_text: "Book a Therapy Session with Noira"
    }
  },
  { 
    id: 2,
    title: "Aromatherapy Blends: Crafting Your Perfect Wellness Ritual",
    category: "Wellness",
    author: "Dr. Emily Hart",
    date: "12 January 2024",
    reading_time: "6 min read",
    banner_image: "https://images.unsplash.com/photo-1596178060671-7a80dc8059ea?q=80&w=1169&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    content: [
      {
        section: "Introduction",
        text: "Aromatherapy is more than a soothing fragrance—it’s a science that uses natural plant extracts to promote holistic wellness. At Noira, we believe the right blend can uplift your mood, restore balance, and create a deeply relaxing experience."
      },
      {
        section: "Popular Blends",
        list: [
          "Lavender + Chamomile for stress relief",
          "Eucalyptus + Peppermint for clarity",
          "Rose + Sandalwood for emotional balance"
        ]
      },
      {
        section: "Conclusion",
        text: "Every scent tells a story. Our therapists personalize each blend to suit your wellness needs, ensuring a truly bespoke ritual."
      }
    ],
    cta: {
      headline: "Discover Aromatherapy at Noira",
      button_text: "Book a Customized Ritual"
    }
  },
  {
    id: 3,
    title: "Stress Relief in the City: Your Urban Wellness Sanctuary",
    category: "Lifestyle",
    author: "Dr. James Carter",
    date: "10 January 2024",
    reading_time: "7 min read",
    banner_image: "https://plus.unsplash.com/premium_photo-1661306478690-f9c09465996b?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    content: [
      {
        section: "Introduction",
        text: "Life in London can be exhilarating—but also overwhelming. At Noira, we specialize in creating an oasis of calm right in the middle of the city, helping busy professionals recharge and restore balance."
      },
      {
        section: "Therapies for Urban Stress",
        list: [
          "Deep Tissue Massage for muscle tension",
          "Aromatherapy for mental clarity",
          "Reflexology for overall relaxation"
        ]
      },
      {
        section: "Conclusion",
        text: "Your city lifestyle doesn’t need to compromise your wellness. Step into Noira and rediscover tranquility in the heart of London."
      }
    ],
    cta: {
      headline: "Escape the Hustle, Embrace Serenity",
      button_text: "Book Your Wellness Session"
    }
  },
  {
    id: 4,
    title: "Can I Book Same-Day Mobile Massage in London?",
    category: "Services",
    author: "Noira Team",
    date: "08 January 2026",
    reading_time: "5 min read",
    banner_image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=1170&auto=format&fit=crop",
    source_link: "https://graphixhubdesign.blogspot.com/2026/01/can-i-book-same-day-mobile-massage-in.html",
    content: [
      {
        section: "The Need for Spontaneity",
        text: "Sometimes, the need for relaxation doesn't come with a warning. Whether it's a sudden muscle spasm from a workout or the culmination of a stressful week, waiting for an appointment isn't always an option. The good news is that London’s mobile massage services are adapting to this fast-paced lifestyle."
      },
      {
        section: "How Same-Day Booking Works",
        text: "At Noira, we have streamlined our booking process to accommodate last-minute requests. Our network of professional therapists covers key areas like Mayfair, Knightsbridge, and Canary Wharf, often allowing us to reach your doorstep within hours."
      },
      {
        section: "Tips for Securing a Slot",
        list: [
          "Book early in the morning for evening slots",
          "Be flexible with your therapist preference",
          "Check our live availability calendar online"
        ]
      }
    ],
    cta: {
      headline: "Need a Massage Today?",
      button_text: "Check Availability Now"
    }
  },
  {
    id: 5,
    title: "Can Couples Book Massage at Home in London?",
    category: "Couples",
    author: "Noira Team",
    date: "11 January 2026",
    reading_time: "6 min read",
    banner_image: "https://images.unsplash.com/photo-1519823551278-64ac927accc9?q=80&w=1024&auto=format&fit=crop",
    source_link: "https://apexracingjournal.blogspot.com/2026/01/can-couples-book-massage-at-home-in.html",
    content: [
      {
        section: "A Shared Experience of Relaxation",
        text: "Turning your living room into a private spa is one of the most romantic and relaxing ways to reconnect with your partner. A couples massage at home removes the hassle of traveling to a spa, allowing you both to drift into relaxation immediately after the treatment."
      },
      {
        section: "Logistics: How We Make It Happen",
        text: "Booking a couples massage implies two therapists and two massage tables. Noira handles all the logistics. Our team arrives with everything needed—luxury oils, music, and tables—transforming your space into a sanctuary for two."
      },
      {
        section: "Perfect Occasions",
        list: [
          "Anniversary celebrations",
          "Valentine's Day surprises",
          "De-stressing together after a busy week"
        ]
      }
    ],
    cta: {
      headline: "Book a Romantic Escape at Home",
      button_text: "Schedule a Couples Massage"
    }
  }
];

// Express controller
const getBlogs = (req, res) => {
  try {
    res.status(200).json({ blogs });
  } catch (error) {
    console.error("Error fetching blogs:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const BlogID = (req, res) => {
  try {
    const { id } = req.params;
    // console.log(id);
    // Use find() if you want a single blog, or filter() for an array
    const blog = blogs.find(b => b.id == id);

    if (!blog) {
      return res.status(404).json({ error: "Blog not found" });
    }

    res.status(200).json({ blog });
  } catch (error) {
    console.error("Error fetching blog by ID:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { getBlogs, BlogID };