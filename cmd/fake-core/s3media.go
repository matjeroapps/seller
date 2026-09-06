package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// s3Media talks to the E2E MinIO instance for the P5.8 media flow. There is no
// faking here: when MinIO is unreachable the media endpoints fail loudly, so
// the E2E suite exercises a real presigned-PUT round trip.
type s3Media struct {
	bucket     string
	endpoint   string
	publicBase string
	client     *s3.Client
	presign    *s3.PresignClient
	urlTTL     time.Duration
	maxBytes   int64
}

func newS3Media() *s3Media {
	endpoint := strings.TrimRight(os.Getenv("S3_ENDPOINT"), "/")
	if endpoint == "" {
		return nil
	}
	bucket := os.Getenv("S3_BUCKET")
	if bucket == "" {
		bucket = "matjero-media"
	}
	region := os.Getenv("S3_REGION")
	if region == "" {
		region = "us-east-1"
	}
	accessKey := os.Getenv("S3_ACCESS_KEY")
	if accessKey == "" {
		accessKey = "minioadmin"
	}
	secretKey := os.Getenv("S3_SECRET_KEY")
	if secretKey == "" {
		secretKey = "minioadmin"
	}
	publicBase := strings.TrimRight(os.Getenv("S3_PUBLIC_BASE_URL"), "/")
	if publicBase == "" {
		publicBase = endpoint + "/" + bucket
	}

	awsCfg := aws.Config{
		Region:      region,
		Credentials: credentials.NewStaticCredentialsProvider(accessKey, secretKey, ""),
	}
	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(endpoint)
		o.UsePathStyle = true
	})
	return &s3Media{
		bucket:     bucket,
		endpoint:   endpoint,
		publicBase: publicBase,
		client:     client,
		presign:    s3.NewPresignClient(client),
		urlTTL:     15 * time.Minute,
		maxBytes:   10 << 20,
	}
}

func (m *s3Media) presignPut(ctx context.Context, key, contentType string) (string, error) {
	req, err := m.presign.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(m.bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	}, s3.WithPresignExpires(m.urlTTL))
	if err != nil {
		return "", fmt.Errorf("presign put object: %w", err)
	}
	return req.URL, nil
}

func (m *s3Media) head(ctx context.Context, key string) (*s3.HeadObjectOutput, error) {
	out, err := m.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(m.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, fmt.Errorf("head object %s: %w", key, err)
	}
	return out, nil
}

func (m *s3Media) delete(ctx context.Context, key string) error {
	_, err := m.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(m.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("delete object %s: %w", key, err)
	}
	return nil
}

func (m *s3Media) publicURI(key string) string {
	return m.publicBase + "/" + key
}

func logS3Config(m *s3Media) {
	if m == nil {
		log.Printf("Fake Core media storage: NOT CONFIGURED (set S3_ENDPOINT to enable the P5.8 media flow)")
		return
	}
	log.Printf("Fake Core media storage: endpoint=%s bucket=%s", m.endpoint, m.bucket)
}
