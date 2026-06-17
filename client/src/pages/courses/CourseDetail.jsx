import React, { useState, useEffect } from 'react'
import { Form, Input, InputNumber, Select, DatePicker, Button, Card, Space, message, Upload, Row, Col, Descriptions, Tag, Divider } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftOutlined, UploadOutlined, SaveOutlined, PlayCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import request from '../../utils/request'

const { Option } = Select
const { TextArea } = Input

export default function CourseDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [course, setCourse] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const [myEnrollment, setMyEnrollment] = useState(null)

  useEffect(() => {
    loadCourse()
    if (user.role === 'employee') loadMyEnrollment()
  }, [id])

  const loadCourse = async () => {
    try {
      const res = await request.get(`/courses/${id}`)
      setCourse(res.data)
    } catch (e) {}
  }

  const loadMyEnrollment = async () => {
    try {
      const res = await request.get('/enrollments/my')
      const enrollments = res.data?.list || []
      const found = enrollments.find(e => e.course_id === parseInt(id))
      setMyEnrollment(found)
    } catch (e) {}
  }

  const uploadProps = {
    name: 'file',
    accept: '.pdf,.mp4',
    maxCount: 1,
    data: { course_id: id },
    customRequest: async ({ file, onSuccess, onError }) => {
      setUploading(true)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('course_id', id)
      try {
        await request.post('/courses/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        message.success('课件上传成功')
        onSuccess?.()
        loadCourse()
      } catch (e) {
        onError?.(e)
      } finally {
        setUploading(false)
      }
    },
    beforeUpload: (file) => {
      const allowedExt = ['.pdf', '.mp4']
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      if (!allowedExt.includes(ext)) {
        message.error('仅支持PDF和MP4格式')
        return Upload.LIST_IGNORE
      }
      if (file.size > 500 * 1024 * 1024) {
        message.error('文件大小不能超过500MB')
        return Upload.LIST_IGNORE
      }
      const namePattern = /^[A-Za-z0-9\u4e00-\u9fa5_\-\s]{1,100}\.(pdf|mp4)$/i
      if (!namePattern.test(file.name)) {
        message.error('文件名仅允许中英文、数字、下划线、短横线和空格，长度1-100字符')
        return Upload.LIST_IGNORE
      }
      return true
    }
  }

  const handleEnroll = async () => {
    setEnrolling(true)
    try {
      await request.post('/enrollments', { course_id: id })
      message.success('报名成功，等待部门主管审批')
      loadMyEnrollment()
    } finally {
      setEnrolling(false)
    }
  }

  const handleDownload = () => {
    window.open(`/api/courses/download/${id}`, '_blank')
  }

  const statusMap = {
    draft: { text: '草稿', color: 'default' },
    published: { text: '已发布', color: 'blue' },
    completed: { text: '已完成', color: 'green' },
    cancelled: { text: '已取消', color: 'red' }
  }

  const enrollmentStatusMap = {
    pending: { text: '待审批', color: 'orange' },
    approved: { text: '已通过', color: 'blue' },
    rejected: { text: '已拒绝', color: 'red' },
    completed: { text: '已完成', color: 'green' },
    cancelled: { text: '已取消', color: 'default' }
  }

  if (!course) return <div style={{ padding: 24 }}>加载中...</div>

  return (
    <div className="page-container">
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>
          <h2 className="page-title">课程详情</h2>
        </Space>
        <Space>
          {user.role === 'employee' && course.status === 'published' && !myEnrollment && (
            <Button type="primary" icon={<PlayCircleOutlined />} loading={enrolling} onClick={handleEnroll}>
              立即报名
            </Button>
          )}
          {user.role === 'trainer' && (
            <Button icon={<SaveOutlined />} onClick={() => navigate(`/courses/${id}/edit`)}>编辑课程</Button>
          )}
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col md={16}>
          <Card title="基本信息">
            <Descriptions column={2} bordered>
              <Descriptions.Item label="课程名称" span={2}>{course.name}</Descriptions.Item>
              <Descriptions.Item label="课程编码">{course.code}</Descriptions.Item>
              <Descriptions.Item label="课程分类">{course.category || '-'}</Descriptions.Item>
              <Descriptions.Item label="学时">{course.hours} 学时</Descriptions.Item>
              <Descriptions.Item label="要求学前学时">{course.required_hours} 学时</Descriptions.Item>
              <Descriptions.Item label="报名名额">{course.enrolled_count || 0} / {course.capacity} 人</Descriptions.Item>
              <Descriptions.Item label="课程状态">
                <Tag color={statusMap[course.status]?.color}>{statusMap[course.status]?.text}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="授课讲师">{course.teacher || '-'}</Descriptions.Item>
              <Descriptions.Item label="培训地点">{course.location || '-'}</Descriptions.Item>
              <Descriptions.Item label="开始时间">{course.start_date}</Descriptions.Item>
              <Descriptions.Item label="结束时间">{course.end_date}</Descriptions.Item>
              <Descriptions.Item label="创建人">{course.creator_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="课程描述" span={2}>{course.description || '-'}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="课程课件" style={{ marginTop: 16 }}>
            {course.courseware_name ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
                  <Space>
                    <UploadOutlined />
                    <span>{course.courseware_name}</span>
                    <Button type="link" onClick={handleDownload}>下载</Button>
                  </Space>
                </div>
              </Space>
            ) : (
              <div style={{ color: '#888', padding: '20px 0', textAlign: 'center' }}>暂无课件</div>
            )}
            {user.role === 'trainer' && (
              <>
                <Divider />
                <Upload {...uploadProps}>
                  <Button icon={<UploadOutlined />} loading={uploading}>
                    {course.courseware_name ? '重新上传课件' : '上传课件'}
                  </Button>
                </Upload>
                <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
                  支持格式：PDF、MP4 | 最大大小：500MB | 命名规范：中英文、数字、下划线、短横线
                </div>
              </>
            )}
          </Card>
        </Col>

        <Col md={8}>
          {user.role === 'employee' && myEnrollment && (
            <Card title="我的报名状态" style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  状态：
                  <Tag color={enrollmentStatusMap[myEnrollment.status]?.color}>
                    {enrollmentStatusMap[myEnrollment.status]?.text}
                  </Tag>
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>报名时间：{myEnrollment.apply_time}</div>
                {myEnrollment.approve_time && (
                  <div style={{ fontSize: 12, color: '#888' }}>审批时间：{myEnrollment.approve_time}</div>
                )}
                {myEnrollment.reject_reason && (
                  <div style={{ fontSize: 12, color: '#ff4d4f' }}>拒绝原因：{myEnrollment.reject_reason}</div>
                )}
              </Space>
            </Card>
          )}

          <Card title="报名须知">
            <div style={{ lineHeight: 1.8, color: '#555' }}>
              <p>1. 报名后需经部门主管审批通过后方可参加培训</p>
              <p>2. 审批超时（2个工作日）将自动升级通知培训管理员</p>
              <p>3. 课程结束后将发布在线考试，通过后可获得证书</p>
              <p>4. 证书有效期1年，到期前30天系统将自动提醒续认证</p>
              <p>5. 如需取消报名，请在课程开始前操作</p>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
