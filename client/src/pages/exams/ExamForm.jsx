import React, { useState, useEffect } from 'react'
import { Form, Input, InputNumber, Select, DatePicker, Button, Card, Space, message, Row, Col } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import request from '../../utils/request'

const { Option } = Select

export default function ExamForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [courses, setCourses] = useState([])
  const [courseQuestionCount, setCourseQuestionCount] = useState(0)
  const isEdit = !!id

  useEffect(() => {
    loadCourses()
    if (isEdit) loadExam()
  }, [id])

  const loadCourses = async () => {
    try {
      const res = await request.get('/courses', { params: { status: 'published', pageSize: 100 } })
      setCourses(res.data?.list || [])
    } catch (e) {}
  }

  const loadExam = async () => {
    setLoading(true)
    try {
      const res = await request.get(`/exams/${id}`)
      const e = res.data
      form.setFieldsValue({
        ...e,
        start_time: dayjs(e.start_time),
        end_time: dayjs(e.end_time)
      })
      if (e.course_id) {
        loadCourseQuestionCount(e.course_id)
      }
    } finally {
      setLoading(false)
    }
  }

  const loadCourseQuestionCount = async (courseId) => {
    try {
      const res = await request.get('/exams/questions', { params: { course_id: courseId, pageSize: 1000 } })
      setCourseQuestionCount(res.data?.length || 0)
    } catch (e) {
      setCourseQuestionCount(0)
    }
  }

  const handleCourseChange = (courseId) => {
    if (courseId) {
      loadCourseQuestionCount(courseId)
    } else {
      setCourseQuestionCount(0)
    }
  }

  const validateQuestionCount = (_, value) => {
    if (value && value > courseQuestionCount) {
      return Promise.reject(new Error(`题目数量不能超过题库中该课程的题目数(${courseQuestionCount})`))
    }
    return Promise.resolve()
  }

  const onFinish = async (values) => {
    setSaving(true)
    try {
      const data = {
        ...values,
        start_time: values.start_time.format('YYYY-MM-DD HH:mm:ss'),
        end_time: values.end_time.format('YYYY-MM-DD HH:mm:ss')
      }

      if (isEdit) {
        await request.put(`/exams/${id}`, data)
        message.success('考试更新成功')
      } else {
        await request.post('/exams', data)
        message.success('考试创建成功')
      }
      navigate('/exams')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>
          <h2 className="page-title">{isEdit ? '编辑考试' : '新建考试'}</h2>
        </Space>
      </div>

      <Card loading={loading}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            duration: 60,
            total_score: 100,
            pass_score: 60,
            question_count: 10,
            status: 'active'
          }}
        >
          <Row gutter={24}>
            <Col md={12}>
              <Form.Item name="course_id" label="课程" rules={[{ required: true, message: '请选择课程' }]}>
                <Select placeholder="请选择已发布的课程" onChange={handleCourseChange}>
                  {courses.map(c => (
                    <Option key={c.id} value={c.id}>{c.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col md={12}>
              <Form.Item name="name" label="考试名称" rules={[{ required: true, message: '请输入考试名称' }]}>
                <Input placeholder="请输入考试名称" maxLength={100} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col md={6}>
              <Form.Item name="duration" label="考试时长(分钟)" rules={[{ required: true, message: '请输入考试时长' }]}>
                <InputNumber min={10} max={300} style={{ width: '100%' }} addonAfter="分钟" />
              </Form.Item>
            </Col>
            <Col md={6}>
              <Form.Item name="total_score" label="总分" rules={[{ required: true, message: '请输入总分' }]}>
                <InputNumber min={10} max={500} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col md={6}>
              <Form.Item name="pass_score" label="及格分" rules={[{ required: true, message: '请输入及格分' }]}>
                <InputNumber min={0} max={500} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col md={6}>
              <Form.Item
                name="question_count"
                label="题目数量"
                rules={[
                  { required: true, message: '请输入题目数量' },
                  { validator: validateQuestionCount }
                ]}
                extra={courseQuestionCount > 0 ? `该课程题库现有 ${courseQuestionCount} 题` : '请先选择课程'}
              >
                <InputNumber min={1} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col md={12}>
              <Form.Item name="start_time" label="开始时间" rules={[{ required: true, message: '请选择开始时间' }]}>
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col md={12}>
              <Form.Item name="end_time" label="结束时间" rules={[{ required: true, message: '请选择结束时间' }]}>
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="status" label="状态">
            <Select>
              <Option value="active">进行中</Option>
              <Option value="closed">已结束</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
                {isEdit ? '保存修改' : '创建考试'}
              </Button>
              <Button onClick={() => navigate(-1)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
