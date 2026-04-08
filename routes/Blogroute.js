const express = require('express');
const path = require('path');
const fs = require('fs');
const Blog = require('../models/Blog');
const cloudinary = require("cloudinary").v2;

const router = express.Router();

// ============================================
// Cloudinary Configuration
// ============================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout: 100000,
});

// ============================================
// Upload Helper - Fire and Forget
// ============================================
const uploadToCloudinary = async (file) => {
  return cloudinary.uploader.upload(file.tempFilePath, {
    folder: "blogs",
  });
};

// ============================================
// SPECIFIC ROUTES FIRST
// ============================================

// POST - Create new blog with Cloudinary upload
router.post('/blog-write', async (req, res) => {
  try {
    const { 
      title, 
      category, 
      author, 
      date, 
      reading_time, 
      htmlContent,
      meta_description,
      meta_keywords
    } = req.body;
    
    if (!title || !category || !author || !date || !htmlContent) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Use placeholder images initially
    let bannerImagePaths = [];
    const hasImages = req.files && req.files.bannerImages;
    
    if (hasImages) {
      // Create placeholder paths
      const files = Array.isArray(req.files.bannerImages) 
        ? req.files.bannerImages 
        : [req.files.bannerImages];
      
      bannerImagePaths = files.map(() => 
        "https://via.placeholder.com/1200x630?text=Uploading..."
      );
    }
    
    // Create blog with placeholder images
    const newBlog = new Blog({
      title,
      category,
      author,
      date,
      reading_time: reading_time || '5 min read',
      bannerImages: bannerImagePaths,
      htmlContent,
      meta_description,
      meta_keywords
    });
    
    await newBlog.save();
    
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    newBlog.generateSchemaMarkup(baseUrl);
    await newBlog.save();
    
    // ✅ RESPOND IMMEDIATELY
    res.status(201).json({
      success: true,
      message: 'Blog published successfully. Images are being uploaded.',
      blog: newBlog
    });

    // ✅ UPLOAD IMAGES IN BACKGROUND (Fire and Forget)
    if (hasImages) {
      const files = Array.isArray(req.files.bannerImages) 
        ? req.files.bannerImages 
        : [req.files.bannerImages];

      // Upload all images in parallel
      Promise.all(
        files.map(file => uploadToCloudinary(file))
      )
        .then(results => {
          const cloudinaryUrls = results.map(result => result.secure_url);
          
          // Update blog with real Cloudinary URLs
          return Blog.updateOne(
            { _id: newBlog._id },
            { 
              $set: { 
                bannerImages: cloudinaryUrls,
                featured_image: cloudinaryUrls[0]
              }
            }
          );
        })
        .then(() => {
          console.log(`✅ Images uploaded to Cloudinary for blog: ${newBlog.title}`);
        })
        .catch(uploadError => {
          console.error(`❌ BACKGROUND UPLOAD FAILED for blog ${newBlog.title}:`, uploadError);
        });
    }
    
  } catch (error) {
    console.error('Error creating blog:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A blog with this title already exists'
      });
    }
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to publish blog',
        error: error.message
      });
    }
  }
});

// GET - Get all blogs
router.get('/', async (req, res) => {
  try {
    const { category, limit = 10, page = 1, sort = '-createdAt', all } = req.query;

    // When `all=true` is passed (admin content manager), include unpublished blogs.
    const query = all === 'true' ? {} : { published: true };
    if (category) {
      query.category = category;
    }
    
    const blogs = await Blog.find(query)
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .select('-htmlContent -schema_markup');
    
    const total = await Blog.countDocuments(query);
    
    res.json({
      success: true,
      blogs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching blogs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blogs',
      error: error.message
    });
  }
});

// GET - Get blog by slug
router.get('/slug/:slug', async (req, res) => {
  try {
    const blog = await Blog.findOne({ slug: req.params.slug, published: true });
    
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }
    
    await blog.incrementViews();
    
    if (!blog.schema_markup) {
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      blog.generateSchemaMarkup(baseUrl);
      await blog.save();
    }
    
    res.json({
      success: true,
      blog
    });
  } catch (error) {
    console.error('Error fetching blog:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blog',
      error: error.message
    });
  }
});

// GET - Sitemap
router.get('/api/sitemap', async (req, res) => {
  try {
    const sitemapData = await Blog.getSitemapData();
    
    res.json({
      success: true,
      sitemap: sitemapData
    });
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate sitemap',
      error: error.message
    });
  }
});

// ============================================
// PARAMETERIZED ROUTES LAST
// ============================================

// GET - Get single blog by ID
router.get('/:id', async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }
    
    await blog.incrementViews();
    
    if (!blog.schema_markup) {
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      blog.generateSchemaMarkup(baseUrl);
      await blog.save();
    }
    
    res.json({
      success: true,
      blog
    });
  } catch (error) {
    console.error('Error fetching blog:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blog',
      error: error.message
    });
  }
});

// PUT - Update blog with Cloudinary upload
router.put('/:id', async (req, res) => {
  try {
    const { 
      title, 
      category, 
      author, 
      date, 
      reading_time, 
      htmlContent,
      meta_description,
      meta_keywords
    } = req.body;
    
    const blog = await Blog.findById(req.params.id);
    
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }
    
    if (title) blog.title = title;
    if (category) blog.category = category;
    if (author) blog.author = author;
    if (date) blog.date = date;
    if (reading_time) blog.reading_time = reading_time;
    if (htmlContent) blog.htmlContent = htmlContent;
    if (meta_description) blog.meta_description = meta_description;
    if (meta_keywords) blog.meta_keywords = meta_keywords;
    
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    blog.generateSchemaMarkup(baseUrl);
    
    await blog.save();
    
    // ✅ RESPOND IMMEDIATELY
    res.json({
      success: true,
      message: 'Blog updated successfully. New images are being uploaded.',
      blog
    });

    // ✅ UPLOAD NEW IMAGES IN BACKGROUND
    if (req.files && req.files.bannerImages) {
      const files = Array.isArray(req.files.bannerImages) 
        ? req.files.bannerImages 
        : [req.files.bannerImages];

      Promise.all(
        files.map(file => uploadToCloudinary(file))
      )
        .then(results => {
          const cloudinaryUrls = results.map(result => result.secure_url);
          
          return Blog.updateOne(
            { _id: blog._id },
            { 
              $push: { bannerImages: { $each: cloudinaryUrls } }
            }
          );
        })
        .then(() => {
          console.log(`✅ New images uploaded for blog: ${blog.title}`);
        })
        .catch(uploadError => {
          console.error(`❌ BACKGROUND UPLOAD FAILED for blog ${blog.title}:`, uploadError);
        });
    }
    
  } catch (error) {
    console.error('Error updating blog:', error);
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to update blog',
        error: error.message
      });
    }
  }
});

// DELETE - Delete blog
router.delete('/:id', async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }
    
    // Delete images from Cloudinary (fire and forget)
    if (blog.bannerImages && blog.bannerImages.length > 0) {
      blog.bannerImages.forEach(imageUrl => {
        // Extract public_id from Cloudinary URL
        const urlParts = imageUrl.split('/');
        const filename = urlParts[urlParts.length - 1].split('.')[0];
        const publicId = `blogs/${filename}`;
        
        cloudinary.uploader.destroy(publicId)
          .then(() => console.log(`✅ Deleted image: ${publicId}`))
          .catch(err => console.error(`❌ Failed to delete image: ${publicId}`, err));
      });
    }
    
    await blog.deleteOne();
    
    res.json({
      success: true,
      message: 'Blog deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting blog:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete blog',
      error: error.message
    });
  }
});

// PATCH - Toggle (or set) blog publish state — used by admin to list/delist a blog
router.patch('/:id/publish', async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    // Allow explicit set via body { published: true|false }, otherwise toggle.
    if (typeof req.body?.published === 'boolean') {
      blog.published = req.body.published;
    } else {
      blog.published = !blog.published;
    }

    await blog.save();

    res.json({
      success: true,
      message: blog.published ? 'Blog listed (published)' : 'Blog delisted (unpublished)',
      published: blog.published,
      blog
    });
  } catch (error) {
    console.error('Error toggling blog publish state:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update blog publish state',
      error: error.message
    });
  }
});

// POST - Like blog
router.post('/:id/like', async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }
    
    blog.likes += 1;
    await blog.save();
    
    res.json({
      success: true,
      likes: blog.likes
    });
  } catch (error) {
    console.error('Error liking blog:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to like blog',
      error: error.message
    });
  }
});

module.exports = router;