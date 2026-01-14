const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  author: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: String,
    required: true
  },
  reading_time: {
    type: String,
    default: '5 min read'
  },
  bannerImages: [{
    type: String
  }],
  htmlContent: {
    type: String,
    required: true
  },
  meta_description: {
    type: String,
    maxlength: 160
  },
  meta_keywords: {
    type: String
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  published: {
    type: Boolean,
    default: true
  },
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  canonical_url: {
    type: String
  },
  featured_image: {
    type: String
  },
  schema_markup: {
    type: String
  }
}, {
  timestamps: true
});

blogSchema.pre('save', async function(next) {
  if (this.isModified('title')) {
    // Generate base slug
    let baseSlug = this.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    
    // Check if slug exists and add number suffix if needed
    let slug = baseSlug;
    let counter = 1;
    
    while (await this.constructor.findOne({ slug, _id: { $ne: this._id } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    this.slug = slug;
  }
  
  if (!this.featured_image && this.bannerImages.length > 0) {
    this.featured_image = this.bannerImages[0];
  }
  
  next();
});
blogSchema.methods.generateSchemaMarkup = function(baseUrl) {
  // Use updatedAt if it exists, otherwise use current date
  const modifiedDate = this.updatedAt 
    ? this.updatedAt.toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": this.title,
    "description": this.meta_description || this.title,
    "image": this.featured_image ? `${baseUrl}${this.featured_image}` : null,
    "author": {
      "@type": "Person",
      "name": this.author
    },
    "publisher": {
      "@type": "Organization",
      "name": "Your Blog Name",
      "logo": {
        "@type": "ImageObject",
        "url": `${baseUrl}/logo.png`
      }
    },
    "datePublished": this.date,
    "dateModified": modifiedDate,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `${baseUrl}/blog/${this.slug}`
    }
  };
  
  this.schema_markup = JSON.stringify(schemaData);
  return schemaData;
};

blogSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

blogSchema.statics.getSitemapData = async function() {
  const blogs = await this.find({ published: true })
    .select('slug updatedAt')
    .lean();
  
  return blogs.map(blog => ({
    url: `/blog/${blog.slug}`,
    lastmod: blog.updatedAt,
    changefreq: 'weekly',
    priority: 0.8
  }));
};

const Blog = mongoose.model('Blog', blogSchema);

module.exports = Blog;